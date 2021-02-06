#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsimageprojStack } from '../lib/awsimageproj-stack';

const app = new cdk.App();
new AwsimageprojStack(app, 'AwsimageprojStack');
