const puppeteer = require('puppeteer');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function scrapeGroupon(zipCode, radius, category) {
  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    
    // Build URL with parameters
    let url = 'https://www.groupon.com';
    
    if (zipCode) {
      url += `/browse/${zipCode}`;
    }
    
    if (category) {
      url += `/${category.toLowerCase().replace(/\s+/g, '-')}`;
    }
    
    if (radius) {
      url += `?radius=${radius}`;
    }
    
    console.log(`\nNavigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Extract deals with better selectors
    const deals = await page.evaluate(() => {
      const dealElements = document.querySelectorAll('[data-test="deal-card"], .deal-card, [class*="DealCard"]');
      
      if (dealElements.length === 0) {
        return Array.from(document.querySelectorAll('a[href*="/deals/"]')).slice(0, 10).map(el => ({
          title: el.innerText || 'N/A',
          url: el.href
        }));
      }
      
      return Array.from(dealElements).slice(0, 10).map(el => ({
        title: el.querySelector('h2, [class*="Title"]')?.innerText || el.innerText.split('\n')[0],
        discount: el.querySelector('[class*="Discount"], [data-test="discount"]')?.innerText || 'N/A',
        url: el.querySelector('a')?.href || 'N/A'
      }));
    });
    
    console.log(`\nFound ${deals.length} deals for "${category || 'all'}" in ${zipCode || 'your area'}`);
    console.log(JSON.stringify(deals, null, 2));
    
  } catch (error) {
    console.error('Error scraping Groupon:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    rl.close();
  }
}

// Main function to get user input
async function main() {
  console.log('=== Groupon Deal Scraper ===\n');
  
  const zipCode = await askQuestion('Enter zip code (or press Enter to skip): ');
  const radius = await askQuestion('Enter search radius in miles (or press Enter to skip): ');
  const category = await askQuestion('Enter deal category (e.g., "restaurants", "spa", "travel"): ');
  
  await scrapeGroupon(zipCode || null, radius || null, category || null);
}

main();