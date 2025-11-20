async function quickTest() {
    console.log('Testing API with timeout...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
        const response = await fetch('http://localhost:3000/api/getAnswer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: "top 10 validators" }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));
        
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.log('Request timed out after 10 seconds');
        } else {
            console.error('Error:', error.message);
        }
    }
}

quickTest();
