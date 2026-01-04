import Stripe from 'stripe';

// ユーザー提供のStripe APIキー
const stripe = new Stripe('sk_test_51SkOeZRpCmDhhjB3MLtNppIMteo5LEi7GHzsJI8GkfBZ2eIXwIoPOgclhLiBWwRD3qARLFT3pbfpVqX0gVmINGzL007UOTIglP', {
  apiVersion: '2024-11-20.acacia',
});

async function setupStripeProducts() {
  console.log('Setting up Stripe products and prices...\n');

  try {
    // 1. Free プラン（無料）
    console.log('Creating Free plan...');
    const freeProduct = await stripe.products.create({
      name: 'QueuePro Free',
      description: '小規模店舗向け無料プラン - 基本的なキュー管理機能',
      metadata: {
        plan_type: 'free',
      },
    });
    
    const freePrice = await stripe.prices.create({
      product: freeProduct.id,
      unit_amount: 0,
      currency: 'jpy',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan_type: 'free',
      },
    });
    console.log(`✓ Free plan created: ${freeProduct.id} (Price: ${freePrice.id})\n`);

    // 2. Standard プラン（月額4,980円）
    console.log('Creating Standard plan...');
    const standardProduct = await stripe.products.create({
      name: 'QueuePro Standard',
      description: '中規模店舗向けスタンダードプラン - SMS/LINE通知、事前注文機能',
      metadata: {
        plan_type: 'standard',
      },
    });
    
    const standardPrice = await stripe.prices.create({
      product: standardProduct.id,
      unit_amount: 498000, // 4,980円（Stripeは最小単位なので100倍）
      currency: 'jpy',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan_type: 'standard',
      },
    });
    console.log(`✓ Standard plan created: ${standardProduct.id} (Price: ${standardPrice.id})\n`);

    // 3. Premium プラン（月額9,980円）
    console.log('Creating Premium plan...');
    const premiumProduct = await stripe.products.create({
      name: 'QueuePro Premium',
      description: '大規模店舗向けプレミアムプラン - 全機能利用可能、優先サポート',
      metadata: {
        plan_type: 'premium',
      },
    });
    
    const premiumPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 998000, // 9,980円
      currency: 'jpy',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan_type: 'premium',
      },
    });
    console.log(`✓ Premium plan created: ${premiumProduct.id} (Price: ${premiumPrice.id})\n`);

    // 結果をまとめて表示
    console.log('='.repeat(60));
    console.log('Stripe Products Setup Complete!');
    console.log('='.repeat(60));
    console.log('\nProduct IDs and Price IDs:');
    console.log(`\nFree Plan:`);
    console.log(`  Product ID: ${freeProduct.id}`);
    console.log(`  Price ID: ${freePrice.id}`);
    console.log(`\nStandard Plan:`);
    console.log(`  Product ID: ${standardProduct.id}`);
    console.log(`  Price ID: ${standardPrice.id}`);
    console.log(`\nPremium Plan:`);
    console.log(`  Product ID: ${premiumProduct.id}`);
    console.log(`  Price ID: ${premiumPrice.id}`);
    
    console.log('\n\nUpdate your stripe/products.ts with these Price IDs:');
    console.log(`
export const STRIPE_PRICE_IDS = {
  free: '${freePrice.id}',
  standard: '${standardPrice.id}',
  premium: '${premiumPrice.id}',
};
`);

    return {
      free: { productId: freeProduct.id, priceId: freePrice.id },
      standard: { productId: standardProduct.id, priceId: standardPrice.id },
      premium: { productId: premiumProduct.id, priceId: premiumPrice.id },
    };
  } catch (error) {
    console.error('Error setting up Stripe products:', error);
    throw error;
  }
}

setupStripeProducts();
