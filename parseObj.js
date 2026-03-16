const fs = require('fs');

const objPath = 'c:\\Users\\rohin\\PhoneAI\\local-ai\\assets\\fox.obj';
const objData = fs.readFileSync(objPath, 'utf-8');

const lines = objData.split('\n');

const vertices = [];
const groups = {};
let currentGroup = 'default';

lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    if (line.startsWith('o ') || line.startsWith('g ')) {
        currentGroup = line.substring(2).trim();
        if (!groups[currentGroup]) {
            groups[currentGroup] = { positions: [], indices: [] };
        }
        return;
    }

    if (line.startsWith('v ')) {
        const parts = line.split(/ +/);
        vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        return;
    }

    if (line.startsWith('f ')) {
        if (!groups[currentGroup]) {
            groups[currentGroup] = { positions: [], indices: [] };
        }
        const parts = line.split(/ +/).slice(1);
        
        // Triangulate polygons
        for (let i = 1; i < parts.length - 1; i++) {
            const v1 = parseInt(parts[0].split('/')[0]) - 1;
            const v2 = parseInt(parts[i].split('/')[0]) - 1;
            const v3 = parseInt(parts[i+1].split('/')[0]) - 1;
            groups[currentGroup].indices.push(v1, v2, v3);
        }
    }
});

let outTS = `// Auto-generated from fox.obj\n\n`;

for (const groupName in groups) {
    const group = groups[groupName];
    if (group.indices.length === 0) continue;

    // To optimize, let's just make it non-indexed vertices arrays, or keep indices. 
    // Wait, keeping common vertices across groups might be weird if indexing from the global vertices array.
    // ThreeJS BufferGeometry requires local indexing or non-indexed.
    // Let's create a local/non-indexed positions array for each group to make it simple.
    
    const localPositions = [];
    for (let i = 0; i < group.indices.length; i++) {
        const vIdx = group.indices[i];
        const v = vertices[vIdx];
        localPositions.push(v[0], v[1], v[2]);
    }

    const niceName = groupName.split(/[\._]/)[0]; // body, jaw, leftear => head etc.

    outTS += `export const ${niceName}GeoData = new Float32Array([\n`;
    for (let i = 0; i < localPositions.length; i += 9) {
        outTS += `    ${localPositions.slice(i, i+9).map(n => n.toFixed(4)).join(', ')}${i + 9 < localPositions.length ? ',' : ''}\n`;
    }
    outTS += `]);\n\n`;
}

fs.writeFileSync('c:\\Users\\rohin\\PhoneAI\\local-ai\\src\\screens\\foxGeometry.ts', outTS);
console.log('Saved kitsuneGeometry.ts!');
