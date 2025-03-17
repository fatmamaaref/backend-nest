const crypto = require("crypto");

// import crypto from 'crypto';
export  const HashPassword = async (password:string) =>  {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(8).toString("hex")

        crypto.scrypt(password, salt, 64, (err:any, derivedKey:any) => {
            if (err) reject(err);
            resolve(salt + ":" + derivedKey.toString('hex'))
        });
    })
    console.log("HashPassword------------>",);
    
}

export const VerifyPassword = async (password:string, hash:any) => {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(":")
        crypto.scrypt(password, salt, 64, (err:any, derivedKey:any) => {
            if (err) reject(err);
            resolve(key == derivedKey.toString('hex'))
        });
    })
}

/* 
* let password:any= 'testpassword';
* hashPassword(password).then(
*    (data:any) => {
*        console.log(data);
*    }
* );
*
* verifyPassword('testpassword', '97e9a246e8c64fa8:4c45bfd7b83e8e8d2f468ee134249ea1e4fb5fb8ca205265549a5cc7a58d5b4ecd19d07d46b6f18e880ebd82c29aa1317e77780abf8d3611307ae22daad09700').then(
*    (data:any) => {
*        console.log(data);
*    }
* );
**/


