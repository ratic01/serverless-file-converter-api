import {SQSHandler} from 'aws-lambda';
import { DynamoDB, S3 } from 'aws-sdk';

const s3=new S3();
const dynamodb=new DynamoDB.DocumentClient();

export const handler: SQSHandler=async(event)=>{
    console.log("Lambda startovana. Poruke u redu:",event.Records.length);

    for(const record of event.Records){
        try{
            const {fileId,bucket,key}=JSON.parse(record.body);

            const originalFile=await s3.getObject({
                Bucket:bucket,
                Key:key,
            }).promise();

            const fileContent=originalFile.Body;

            const newKey=`converted/${key.split('/').pop()}`;

            await s3.putObject({
                Bucket:bucket,
                Key:newKey,
                Body:fileContent,
            }).promise();


            await dynamodb.update({
                TableName: process.env.TABLE_NAME!,
                Key: { fileId },
                UpdateExpression: 'set #s = :s',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: { ':s': 'converted' },
            }).promise();

            console.log(` Fajl ${fileId} obrađen i status ažuriran.`)

        }catch(error){
            console.error("Greska u obradi poruke: ",error)
        }        
               
    }

    console.log("Lambda zavrsila obradu svih poruka")
}
