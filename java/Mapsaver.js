kevin = new Map ([["blue", "shirt"], ["eye","pear"]]);
kevin.set("bird","water");
const fs = require('fs'); 
var currentdate = new Date(); 
var datetime = ""
+ currentdate.getFullYear() + "-"  
+ (currentdate.getMonth()+1)  + "-" 
+ currentdate.getDate() + "@"
+ currentdate.getHours() + ":"  
+ currentdate.getMinutes() + ":" 
+ currentdate.getSeconds();

console.log(datetime)
let filename = `./star_${(datetime)}.txt`;
console.log(filename)
//console.log(`Add here ${filename}`);
//fs.writeFileSync(filename , JSON.stringify([...kevin]) , 'utf-8'); 

