import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

import { Duration, RemovalPolicy } from 'aws-cdk-lib';

import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    //s3
    const fileBucket=new s3.Bucket(this,'FileStorageBucket',{
      versioned: true, 
      removalPolicy: RemovalPolicy.DESTROY, 
     autoDeleteObjects: true, 
    })


    //dynamodb tabela za pracenje statusa fajlova

    const fileTable=new dynamodb.Table(this,'FileStatusTable',{
      partitionKey: { name: 'fileId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const fileQueue = new sqs.Queue(this, 'FileProcessingQueue', {
     visibilityTimeout: Duration.seconds(300),
     removalPolicy: RemovalPolicy.DESTROY,
   });

    //SQS red za asinkronu obradu konverzije fajlova
    const conversionQueue=new sqs.Queue(this,'FileConversionQueue',{
      visibilityTimeout: Duration.seconds(300), // vreme dok se poruka "skriva" dok je obrada u toku
      retentionPeriod: Duration.days(1),        // koliko dugo čuvamo poruke ako nisu obrađene
    })

    //Kreiramo Lambda funkciju iz foldera uploadHandler
    const uploadHandler=new lambda.Function(this,'UploadHandlerFunction',{
       runtime: lambda.Runtime.NODEJS_18_X,
       handler: 'dist/index.handler',
       code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/uploadHandler')),
       environment: {
         TABLE_NAME: fileTable.tableName,  // povežemo s DynamoDB
         QUEUE_URL: fileQueue.queueUrl     // povežemo s redom
  },
    })
    fileTable.grantWriteData(uploadHandler);
    fileQueue.grantSendMessages(uploadHandler);


    //lambda funkcija za konverziju fajlova
    const converterHandler=new lambda.Function(this, 'ConverterHnadlerFunction',{
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/converterHandler')),
      environment: {
        TABLE_NAME: fileTable.tableName,
      },
    })
    fileBucket.grantReadWrite(converterHandler);
    fileTable.grantWriteData(converterHandler);

    //povezu lambdu sa redom
    converterHandler.addEventSource(
      new lambdaEventSources.SqsEventSource(fileQueue)
    );


    // Kreiramo REST API
    const api=new apigateway.RestApi(this,'FileConverterApi',{
       restApiName: 'File Converter Service',
       description: 'API Gateway for file upload and conversion',
    })

    const upload=api.root.addResource('upload');
    
// Povezujemo POST metod na /upload sa uploadHandler Lambda funkcijom
    upload.addMethod('POST',new apigateway.LambdaIntegration(uploadHandler));

    
  }
  
}
