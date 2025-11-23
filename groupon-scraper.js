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

function filterRelevantDeals(deals, categorySearchTerm) {
  if (!categorySearchTerm || categorySearchTerm.trim() === '') {
    return deals;
  }
  
  const searchTerm = categorySearchTerm.toLowerCase().trim();
  
  const searchVariations = [
    searchTerm,
    searchTerm.endsWith('s') ? searchTerm.slice(0, -1) : searchTerm + 's',
    searchTerm.replace(/-/g, ' '),
    searchTerm.replace(/\s+/g, '-')
  ];
  
  const synonymMap = {
    'restaurant': ['dining', 'food', 'eat', 'meal', 'cuisine', 'cafe', 'bistro', 'eatery'],
    'spa': ['massage', 'wellness', 'relaxation', 'beauty', 'facial', 'sauna'],
    'travel': ['hotel', 'vacation', 'trip', 'getaway', 'resort', 'flight'],
    'fitness': ['gym', 'workout', 'exercise', 'yoga', 'training'],
    'entertainment': ['show', 'concert', 'event', 'theater', 'movie', 'performance'],
    'beauty': ['salon', 'hair', 'nails', 'makeup', 'cosmetic', 'spa'],
    'health': ['medical', 'dental', 'doctor', 'clinic', 'wellness', 'healthcare']
  };
  
  const synonyms = [];
  for (const [key, values] of Object.entries(synonymMap)) {
    if (searchVariations.some(variation => key.includes(variation) || variation.includes(key))) {
      synonyms.push(...values);
    }
  }
  
  return deals.filter(deal => {
    const titleLower = (deal.title || '').toLowerCase();
    const descriptionLower = (deal.description || '').toLowerCase();
    const combinedText = `${titleLower} ${descriptionLower}`;
    
    const matchesExact = searchVariations.some(variation => 
      titleLower.includes(variation) || descriptionLower.includes(variation)
    );
    
    const matchesSynonym = synonyms.some(synonym => 
      combinedText.includes(synonym)
    );
    
    return matchesExact || matchesSynonym;
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
    
    // Extract deals with better selectors and additional metadata
    const deals = await page.evaluate(() => {
      const dealElements = document.querySelectorAll('[data-testid^="deal-card-"], [data-test="deal-card"], .deal-card, [class*="DealCard"]');
      
      if (dealElements.length === 0) {
        return Array.from(document.querySelectorAll('a[href*="/deals/"]')).slice(0, 10).map(el => ({
          title: el.innerText || 'N/A',
          description: '',
          url: el.href
        }));
      }
      
      return Array.from(dealElements).map(el => {
        const title = el.querySelector('h2, h3, [class*="Title"], [class*="title"]')?.innerText || el.innerText.split('\n')[0];
        const discount = el.querySelector('[class*="Discount"], [class*="discount"], [data-test="discount"]')?.innerText || 'N/A';
        const url = el.querySelector('a')?.href || 'N/A';
        
        const allText = el.innerText || '';
        const description = allText.replace(title, '').trim();
        
        return {
          title: title,
          discount: discount,
          url: url,
          description: description
        };
      });
    });
    
    const filteredDeals = filterRelevantDeals(deals, category);
    
    const outputDeals = filteredDeals.slice(0, 10).map(deal => ({
      title: deal.title,
      discount: deal.discount,
      url: deal.url
    }));
    
    console.log(`\nFound ${outputDeals.length} relevant deals for "${category || 'all'}" in ${zipCode || 'your area'}`);
    console.log(JSON.stringify(outputDeals, null, 2));
    
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
