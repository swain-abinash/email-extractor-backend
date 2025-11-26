import https from "https";

const testConnectivity = () => {
    console.log("Testing connectivity to https://sulopa.com...");

    const options = {
        hostname: 'sulopa.com',
        port: 443,
        path: '/',
        method: 'GET',
        // Reject unauthorized to see if it's a cert error
        rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
        console.log(`statusCode: ${res.statusCode}`);
        console.log('headers:', res.headers);

        res.on('data', (d) => {
            // process.stdout.write(d);
        });

        res.on('end', () => {
            console.log('\nResponse received successfully.');
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error:', error);
    });

    req.end();
};

testConnectivity();
