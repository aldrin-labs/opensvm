const fs = require('fs');

async function testValidatorAPI() {
    try {
        console.log('Testing validator API...');
        
        const response = await fetch('http://localhost:3000/api/getAnswer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: "top 10 validators"
            })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const text = await response.text();
        console.log('Response length:', text.length);
        console.log('Response content:');
        console.log('=' * 50);
        console.log(text);
        console.log('=' * 50);
        
        // Save to file for analysis
        fs.writeFileSync('validator-response.txt', text);
        console.log('Response saved to validator-response.txt');
        
    } catch (error) {
        console.error('Error testing API:', error);
    }
}

testValidatorAPI();
