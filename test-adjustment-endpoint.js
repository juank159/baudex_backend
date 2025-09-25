const https = require('https');
const http = require('http');

// Test data matching the frontend format
const testData = {
  "productId": "a36c5958-0230-4f67-b3f8-86ac72c5df82",
  "adjustmentQuantity": -1,
  "warehouseId": "46aa186a-60cb-4cc4-a96a-ec60263f68d9",
  "notes": "Transfer out to warehouse: 41b44f4b-31f3-4ad1-88af-acfd3b78452a",
  "movementDate": null
};

// Test with a simple positive adjustment
const testDataPositive = {
  "productId": "a36c5958-0230-4f67-b3f8-86ac72c5df82",
  "adjustmentQuantity": 5,
  "warehouseId": "46aa186a-60cb-4cc4-a96a-ec60263f68d9",
  "notes": "Manual stock increase",
  "unitCost": 100,
  "movementDate": null
};

function testEndpoint(data, testName) {
  const postData = JSON.stringify(data);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/inventory/adjustments/relative',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      // You'll need to add a valid JWT token here
      'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
    }
  };

  console.log(`\n🧪 Testing ${testName}:`);
  console.log('Data:', JSON.stringify(data, null, 2));

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Headers:', res.headers);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        console.log('Response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Raw response:', responseData);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

console.log('🚀 Testing new adjustment endpoint...');
console.log('Note: You need to add a valid JWT token to the Authorization header');

// Uncomment to test (need valid JWT token)
// testEndpoint(testData, 'Negative Adjustment (Original Frontend Format)');
// setTimeout(() => testEndpoint(testDataPositive, 'Positive Adjustment'), 1000);