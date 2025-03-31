
import { HashPassword } from "./password.js";


import Prisma from "./prisma.js";

// import crypto from 'crypto';

const crypto = require("crypto");
import * as bcrypt from 'bcryptjs';
export async function ADMINAUTO() {
    try {
      console.log(process.env.DATABASE_URL);
      // Recherche de l'utilisateur
      const userSearch = await Prisma.user.findFirst({
        where: {
          email: "admin@Admin.com",
        },
      });
      // Si l'utilisateur n'existe pas, le créer avec leur role
      if (!userSearch) {
        const hashedPassword = await bcrypt.hash("pass@123456", 10); 
        const newemp = await Prisma.user.create({
          data: {
            email: "admin@Admin.com",
            full_name: "ADMIN",
            phone_number: "xxxxxxxx",
            password: hashedPassword,
      
            role: "ADMIN",
          },
        });
        console.log(
          "**************** Admin created *************************"
        );
      }
  
      }
     catch (error) {
      console.error(error);
    } finally {
      await Prisma.$disconnect();
    }  }
    
    export function hideEmail(email: string) {
        if (email) {
          return email?.replace(
            /(.{2})(.*)(?=@)/,
            function (gp1: any, gp2: string, gp3: string | any[]) {
              for (let i = 0; i < gp3.length; i++) {
                gp2 += "*";
              }
              return gp2;
            }
          );
        }
      }
      
      export function hideName(name: string) {
        console.log(name);
      
        if (name && name.length > 2) {
          let nonMaskedNumber = name?.slice(0, 2);
      
          let maskChar = "*".repeat(name.length - 2);
      
          return `${nonMaskedNumber}${maskChar}`;
        }
      }
      
      export function mask(mobile_number: string, maskCount: number) {
        if (mobile_number && mobile_number.length > 4) {
          let nonMaskedNumber1 = mobile_number.slice(0, 4);
      
          // let nonMaskedNumber2 = mobile_number.slice(mobile_number.length-3, mobile_number.length);
          let maskChar = "*".repeat(mobile_number.length - 4);
      
          return `${nonMaskedNumber1}${maskChar}`;
        }
      }
      



export function generateSecretKeyCryptage(email: string) {
    const secret = process.env.SECRET_CRYPTAGE; // Utilisez la clé de cryptage à partir des variables d'environnement
    console.log(email);
  
    if (!secret || !email) {
      throw new Error(
        "SECRET_CRYPTAGE is not defined in the environment variables"
      );
    }
    return crypto.createHmac("sha256", secret).update(email).digest("hex");
  }
  
  // Fonction pour chiffrer les données
  export function encrypt(text: string, key: string): string {
    console.log(text);
  
    const iv = Buffer.from("0123456789ABCDEF0123456789ABCDEF", "hex");
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(key, "hex"),
      iv
    );
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }
  // Fonction pour déchiffrer les données
  export function decrypt(encryptedText: string, key: string): string {
    const iv = Buffer.from("0123456789ABCDEF0123456789ABCDEF", "hex"); // Il est important d'utiliser le même vecteur d'initialisation (IV) utilisé pour le chiffrement
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(key, "hex"),
      iv
    );
    encryptedText = encryptedText.slice(9);
  
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }