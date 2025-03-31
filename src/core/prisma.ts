import { generateSecretKeyCryptage, encrypt, decrypt } from "./data";
import { PrismaClient } from "@prisma/client";
import { hideEmail, hideName, mask } from "./data.js";
const Prisma = new PrismaClient();
export type GroupedItemsByDate = {
  date: Date;
};

Prisma.$use(async (params, next) => {
  // console.log(params.model,params.action,params );
  //  const {email,mobile,name} = params?.args?.where
  //      const Value = email||mobile||name
  //      if(email||mobile||name){
  //       const secretkeyencrypte = generateSecretKeyCryptage(email);
  //        console.log('secretkeyencrypte',secretkeyencrypte);
  //          const email1 = encrypt(email,secretkeyencrypte);
  //        console.log('email1 : ',email1);
  //        const secretCryptage = process.env.SECRET_CRYPTAGE;
  //  const emailbase = secretCryptage+email1;
  //  const namebase = secretCryptage+email1;
  //  const mobilebase = secretCryptage+email1;
  //        params.args.where.email =emailbase

  //        //************************************************************ */
  //        let result = await next(params)
  //        console.log( "result : ",result);
  //        const decruptEmail = decrypt(result.email,secretkeyencrypte);

  //        result.email=decruptEmail
  //        if(params.model=="winners" ||params.model=="client" ||params.model=="history"  ){
  //         if (params.action === 'findMany') {

  //           result = result.map((item: any)=>{
  //             return {
  //               ...item,email_hide:hideEmail(item.email),
  //               mobile_hide:mask(item.mobile,3),
  //               name_hide: hideName(item.name)
  //             }
  //           })
  //           return result
  //         }
  //       }

  // return result
  //      }

  if (params.action === "findMany") {
    let result = await next(params);

    result = result.map((item: any) => {
      return {
        ...item,
        email_hide: hideEmail(item.email),
        mobile_hide: mask(item.mobile, 3),
        name_hide: hideName(item.name),
      };
    });
    return result;
  }

  // Manipulate params here

  const result = await next(params);
  // See results here
  return result;
});

export default Prisma;
