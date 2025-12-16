
const apiKey = 'sk-sOhCZbBj3757Aa2688a3T3BLBKFJE240B0cdFbfb4C87a999';
const targetUrl = 'https://api.ohmygpt.com/v1/models';

async function testFetch() {
  console.log('Testing Node.js fetch...');
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://api.ohmygpt.com',
        'Referer': 'https://api.ohmygpt.com/'
      }
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Body:', text.slice(0, 200));
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testFetch();
