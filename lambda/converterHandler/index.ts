import {SQSHandler} from 'aws-lambda';

export const handler: SQSHandler=async(event)=>{
    console.log("Pocetak obrade SQS poruke");

    for(const record of event.Records){
        console.log("Poruka primljena iz reda: ",record.body)
    }

    console.log("Kraj obrade")
}
