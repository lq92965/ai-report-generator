/**
 * Google Play 订阅：服务端验单 + Pub/Sub RTDN 同步。
 * 环境变量：GOOGLE_PLAY_SERVICE_ACCOUNT_JSON（服务账号 JSON 全文或 base64）
 * GOOGLE_PLAY_RTDN_AUDIENCE（与 Pub/Sub 推送 OIDC 受众一致，一般为推送 URL）
 * GOOGLE_PLAY_RTDN_VERIFICATION=0 时跳过 RTDN JWT 校验（仅调试）
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

function addDays(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d;
}

function parseServiceAccountJson() {
    const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!raw || !String(raw).trim()) return null;
    const s = String(raw).trim();
    try {
        if (s.startsWith('{')) return JSON.parse(s);
        return JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
    } catch (e) {
        console.error('[Google Play] Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:', e.message);
        return null;
    }
}

let publisherPromise;

async function getAndroidPublisher() {
    if (publisherPromise) return publisherPromise;
    const creds = parseServiceAccountJson();
    if (!creds) {
        throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON missing');
    }
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });
    const authClient = await auth.getClient();
    publisherPromise = google.androidpublisher({ version: 'v3', auth: authClient });
    return publisherPromise;
}

export async function fetchSubscriptionV2(packageName, purchaseToken) {
    const androidpublisher = await getAndroidPublisher();
    const { data } = await androidpublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken
    });
    return data;
}

function expiryFromV2(v2) {
    const items = v2?.lineItems;
    if (!Array.isArray(items) || !items.length) return null;
    let best = null;
    for (const li of items) {
        const t = li?.expiryTime;
        if (!t) continue;
        const d = new Date(t);
        if (Number.isNaN(d.getTime())) continue;
        if (!best || d.getTime() > best.getTime()) best = d;
    }
    return best;
}

function paidRowFromPlay(tier, internalPlanId, exp, now) {
    const row = {
        plan: tier,
        planSku: internalPlanId,
        planExpiresAt: exp,
        planQueue: null,
        billingProvider: 'google_play'
    };
    if (tier === 'basic') {
        row.usageResetAt = addDays(now, 30);
    } else {
        row.usageResetAt = null;
        row.bonusCredits = 0;
    }
    return row;
}

function buildUserUpdateFromV2(v2, internalPlanId) {
    const state = String(v2?.subscriptionState || '').toUpperCase();
    const exp = expiryFromV2(v2);
    const tier = String(internalPlanId).toLowerCase().startsWith('pro') ? 'pro' : 'basic';
    const now = new Date();

    /** Revoked = access removed regardless of printed expiry. */
    if (state === 'SUBSCRIPTION_STATE_REVOKED') {
        return {
            plan: 'free',
            planSku: null,
            planExpiresAt: null,
            usageCount: 0,
            planQueue: null,
            billingProvider: 'google_play'
        };
    }

    /**
     * Any future expiryTime on line items ⇒ paid through that instant (incl. canceled-but-not-ended, odd states, first-verify quirks).
     */
    if (exp && exp.getTime() > now.getTime()) {
        return paidRowFromPlay(tier, internalPlanId, exp, now);
    }

    if (
        state === 'SUBSCRIPTION_STATE_EXPIRED' ||
        state === 'SUBSCRIPTION_STATE_CANCELED'
    ) {
        return {
            plan: 'free',
            planSku: null,
            planExpiresAt: null,
            usageCount: 0,
            planQueue: null,
            billingProvider: 'google_play'
        };
    }

    return {
        plan: 'free',
        planSku: null,
        planExpiresAt: null,
        usageCount: 0,
        planQueue: null,
        billingProvider: 'google_play'
    };
}

async function acknowledgeSubscription(androidpublisher, packageName, subscriptionId, token) {
    try {
        await androidpublisher.purchases.subscriptions.acknowledge({
            packageName,
            subscriptionId,
            token
        });
    } catch (e) {
        if (e?.code === 409 || /already/i.test(String(e?.message || ''))) return;
        console.warn('[Google Play] acknowledge:', e.message);
    }
}

export function registerGooglePlayBillingRoutes(app, ctx) {
    const {
        db,
        ObjectId,
        authenticateToken,
        sendSystemMessage,
        GOOGLE_PLAY_PACKAGE_NAME,
        GOOGLE_PLAY_PRODUCT_TO_PLAN
    } = ctx;

    const packageName = GOOGLE_PLAY_PACKAGE_NAME;

    app.post('/api/billing/google-play/verify', authenticateToken, async (req, res) => {
        try {
            const purchaseToken = String(req.body?.purchaseToken || '').trim();
            const productId = String(req.body?.productId || '').trim();
            const userId = req.user.userId;

            if (!purchaseToken || !productId) {
                return res.status(400).json({ success: false, message: 'Missing purchaseToken or productId' });
            }

            const internalPlanId = GOOGLE_PLAY_PRODUCT_TO_PLAN[productId];
            if (!internalPlanId) {
                return res.status(400).json({ success: false, message: 'Unknown productId' });
            }

            const v2 = await fetchSubscriptionV2(packageName, purchaseToken);
            const androidpublisher = await getAndroidPublisher();
            await acknowledgeSubscription(androidpublisher, packageName, productId, purchaseToken);

            const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            const fields = buildUserUpdateFromV2(v2, internalPlanId);
            await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: fields });

            await db.collection('google_play_subscriptions').updateOne(
                { purchaseToken },
                {
                    $set: {
                        userId: String(userId),
                        productId,
                        packageName,
                        subscriptionState: v2?.subscriptionState,
                        lastSyncedAt: new Date()
                    },
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );

            const existingPay = await db.collection('payments').findOne({
                googlePurchaseToken: purchaseToken,
                status: 'completed'
            });
            if (!existingPay) {
                const payEmail = String(user.email || '').toLowerCase().trim();
                await db.collection('payments').insertOne({
                    userId: new ObjectId(userId),
                    userEmail: payEmail,
                    email: payEmail,
                    planId: internalPlanId,
                    paymentId: `gp_${purchaseToken.slice(0, 32)}`,
                    provider: 'google_play',
                    googlePurchaseToken: purchaseToken,
                    amount: null,
                    date: new Date(),
                    status: 'completed'
                });
            }

            try {
                await sendSystemMessage(user.email, 'Subscription active', 'Your Google Play subscription is linked.');
            } catch (_) {}

            return res.json({
                success: true,
                message: 'Verified',
                plan: fields.plan,
                planExpiresAt: fields.planExpiresAt
            });
        } catch (e) {
            console.error('[Google Play verify]', e);
            return res.status(500).json({ success: false, message: e.message || 'Verification failed' });
        }
    });

    app.post('/api/billing/google-play/rtdn', async (req, res) => {
        try {
            const skip = process.env.GOOGLE_PLAY_RTDN_VERIFICATION === '0';
            if (!skip) {
                const aud = process.env.GOOGLE_PLAY_RTDN_AUDIENCE || '';
                const auth = req.headers.authorization;
                if (aud && auth?.startsWith('Bearer ')) {
                    const token = auth.slice(7);
                    const client = new OAuth2Client();
                    await client.verifyIdToken({ idToken: token, audience: aud });
                }
            }

            const msg = req.body?.message;
            if (!msg?.data) {
                return res.status(400).send('no message');
            }

            let decoded;
            try {
                decoded = JSON.parse(Buffer.from(msg.data, 'base64').toString('utf8'));
            } catch (e) {
                return res.status(400).send('bad data');
            }

            const notif = decoded.subscriptionNotification;
            if (!notif?.purchaseToken) {
                return res.status(204).send();
            }

            const purchaseToken = notif.purchaseToken;
            const subscriptionId = notif.subscriptionId;

            const row = await db.collection('google_play_subscriptions').findOne({ purchaseToken });
            if (!row?.userId) {
                console.warn('[RTDN] unknown purchaseToken');
                return res.status(204).send();
            }

            const productId = subscriptionId || row.productId;
            const internalPlanId = GOOGLE_PLAY_PRODUCT_TO_PLAN[productId];
            if (!internalPlanId) {
                console.warn('[RTDN] unknown product', productId);
                return res.status(204).send();
            }

            const v2 = await fetchSubscriptionV2(packageName, purchaseToken);
            const fields = buildUserUpdateFromV2(v2, internalPlanId);
            await db.collection('users').updateOne({ _id: new ObjectId(row.userId) }, { $set: fields });

            await db.collection('google_play_subscriptions').updateOne(
                { purchaseToken },
                {
                    $set: {
                        subscriptionState: v2?.subscriptionState,
                        productId,
                        lastSyncedAt: new Date()
                    }
                }
            );

            return res.status(204).send();
        } catch (e) {
            console.error('[RTDN]', e);
            return res.status(500).send('err');
        }
    });
}
