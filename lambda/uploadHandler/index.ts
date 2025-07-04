import {SQS} from 'aws-sdk';
import {DynamoDB} from 'aws-sdk'

const sqs=new SQS();
const dynamodb=new DynamoDB.DocumentClient();


export const handler=async (event:any)=>{
      console.log("TABLE_NAME iz env:", process.env.TABLE_NAME);
      console.log("QUEUE_URL iz env:", process.env.QUEUE_URL);
    const body=JSON.parse(event.body);
    const {fileId,originalName,bucket,key}=body;


    await dynamodb.put({
        TableName:process.env.TABLE_NAME!,
        Item:{
            fileId,
            originalName,
            status:'pending',
            timestamp:Date.now(),
        }
    }).promise();

    await sqs.sendMessage({
        QueueUrl:process.env.QUEUE_URL!,
        MessageBody:JSON.stringify({fileId,bucket,key})
    }).promise();


    return{
        statusCode:200,
        body:JSON.stringify({message:'File received and queued for processing.'})
    }
}