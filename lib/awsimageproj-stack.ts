import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import lambda = require('@aws-cdk/aws-lambda');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import {Duration} from "@aws-cdk/core";
import iam = require('@aws-cdk/aws-iam');
import event_sources = require('@aws-cdk/aws-lambda-event-sources');

const imageBucketName = "cdk-rekn-imagebucket"
const resizedBucketName = imageBucketName + "-resized"


export class AwsimageprojStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // ====================================================================
        // Image Bucket
        // ====================================================================

        const imagBucket = new s3.Bucket(this, imageBucketName, {removalPolicy: cdk.RemovalPolicy.DESTROY});
        new cdk.CfnOutput(this, 'imagBucket', {value: imagBucket.bucketName})

        // ======================================================================
        // Thumbnail Bucket
        // ======================================================================

        const resizedBucket = new s3.Bucket(this, resizedBucketName, {removalPolicy: cdk.RemovalPolicy.DESTROY});
        new cdk.CfnOutput(this, 'imagBucket', {value: resizedBucket.bucketName})


        // ====================================================================
        // Amazon DynamoDB Table for Storing Image Labels
        // ====================================================================

        const table = new dynamodb.Table(this, 'ImageLabels', {
            partitionKey: {
                name: 'image',
                type: dynamodb.AttributeType.STRING
            }
        });
        new cdk.CfnOutput(this, 'ddbTable', {value: table.tableName});


        // =========================================================================
        // Building our AWS Lambda function; compute for our serverless microservice
        // =========================================================================
        const layer = new lambda.LayerVersion(this, 'pil', {
            code: lambda.Code.fromAsset('reklayer'),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
            license: 'Apache-2.0',
            description: 'A layer to enable the PIL library in our Rekognintion Lambda',
        });


        // =========================================================================
        // Building our AWS Lambda function; compute for our serverless microservice
        // =========================================================================
        const rekFn = new lambda.Function(this, 'rekognitionFunction', {
            code: lambda.Code.fromAsset('rekognitionlambda'),
            runtime: lambda.Runtime.PYTHON_3_7,
            handler: 'index.handler',
            timeout: Duration.seconds(30),
            memorySize: 1024,
            layers: [layer],
            environment: {
                "TABLE": table.tableName,
                "BUCKET": imagBucket.bucketName,
                "THUMBBUCKET": resizedBucket.bucketName
            },
        });
        rekFn.addEventSource(new event_sources.S3EventSource(imagBucket, {events: [s3.EventType.OBJECT_CREATED]}));
        imagBucket.grantRead(rekFn);
        table.grantWriteData(rekFn);
        resizedBucket.grantPut(rekFn);

        rekFn.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['rekognition:DetectLabels'],
            resources: ['*']
        }));

        // ================================
        // Lambda for Synchronous Front End
        // ================================

        const serviceFn = new lambda.Function(this, 'serviceFunction', {
            code: lambda.Code.fromAsset('servicelambda'),
            runtime: lambda.Runtime.PYTHON_3_7,
            handler: 'index.handler',
            environment: {
                "TABLE": table.tableName,
                "BUCKET": imagBucket.bucketName,
                "RESIZEDBUCKET": resizedBucket.bucketName

            },


        });
        imagBucket.grantWrite(serviceFn);
        resizedBucket.grantWrite(serviceFn);
        table.grantReadWriteData(serviceFn);


        // The code that defines your stack goes here (which is above mentioned code in this script)
    }

}
