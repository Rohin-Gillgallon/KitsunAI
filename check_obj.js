const fs = require('fs');

const objPath = 'c:\\Users\\rohin\\PhoneAI\\local-ai\\assets\\fox.obj';
const objData = fs.readFileSync(objPath, 'utf-8');

const lines = objData.split('\n');

const groups = new Set();

lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('o ') || line.startsWith('g ')) {
        const name = line.substring(2).trim();
        groups.add(name);
    }
});

console.log('Found groups/objects:', Array.from(groups));
