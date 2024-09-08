import bs58 from 'bs58'

const mynumbers = ``.split(',').map(Number);

const result = bs58.encode(Buffer.from(mynumbers));

console.log(`${result}`);