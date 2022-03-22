---
layout: post
title: Detection of Malicious Content in Files Uploaded to S3 Bucket
date: 2022-03-22
tag: aws, aws security, s3 antivirus, aws antivirus, aws s3 antivirus, s3 malicious file
categories: general
permalink: detection-of-malicious-content-in-files-uploaded-to-S3-bucket
published: true
lang: en
---
## TLDR;
No service scans for malicious content on files uploaded to S3 Buckets on AWS. There are some free and paid 3rd solutions to this problem. This article focuses on installing and using one of these open source solutions, along with a brief introduction to paid and other free solutions. We will briefly talk about S3 Antiviruses.

## The Problem
Undoubtedly, S3 is one of the most frequently used services of AWS. You can keep the files uploaded to your applications on S3, use it to store log files, and use S3 for almost any build that requires storage. This will be completely tailored to your needs. Of course, in some scenarios, you may want the files uploaded to S3 to be viewed and/or downloaded by the end-users of your application. At this point, you can use Macie, a service of AWS, to detect sensitive data in the files uploaded to your S3 Bucket and take necessary actions regarding this data. So, isn't it important to check whether the files uploaded to your S3 Bucket contain harmful content? At this point, there is no service available from AWS. But of course, there is a solution to this too. It even has multiple solutions. In this blogpost, I will tell you how we can detect harmful content uploaded to S3 Buckets.

## Detection of Malicious File Uploaded to S3 Buckets with BucketAV (ClamAV)
BucketAV offers both free and paid solutions. In this blog post, I will focus on the free and open-source version. You can find detailed information about the paid version <a href="https://bucketav.com/" target="_blank">here.</a> Let's take a closer look at this solution and experience it by installing it in our AWS environment.

Let's take a closer look at this solution and experience it by installing it in our AWS environment. It is really simple to set up and use. CloudFormation Templates perform most of the configurations we need to do.

### Some Feature The Project
- It uses ClamAV to detect harmful content and its signature database is constantly updated.
- It automatically deletes harmful content from S3 Bucket. (Optionally)
- When a malicious file is uploaded to Bucket, it can send a Mail notification via SNS.
- Logs to CloudWatch.
- An EC2 wakes up the machine and the system runs there. At this point, it automatically scales the machines. (The reason it needs an EC2 machine is that it uses the clamscan command for malicious content detection.)

### Installation
As I said before, the installation is quite simple. We'll be installing using CloudFormation Templates soon, but let's talk about what these Templates do in the background.

The first template we will use creates public and private subnets in two different AZs using VPC. Of course, it also makes Route Tables for these subnets, Internet Gateway, and Network ACL settings for the Public subnet. You can analyze it yourself by downloading the Template we use from <a href="https://s3-eu-west-1.amazonaws.com/widdix-aws-cf-templates-releases-eu-west-1/stable/vpc/vpc-2azs.yaml" target="_blank">here.</a>

The other template we will use is to set up the EC2 instance, configure the Auto Scaling Group, and make all other settings such as SQS, SNS, and CloudWatch. In other words, the main template that helps us to solve the problem we focus on is this second template.  You can analyze it yourself by downloading the Template we use from <a href="https://s3-eu-west-1.amazonaws.com/widdix-aws-s3-virusscan/template.yaml" target="_blank">here.</a>

For installation, let's set up our first template on AWS from <a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://s3-eu-west-1.amazonaws.com/widdix-aws-cf-templates-releases-eu-west-1/stable/vpc/vpc-2azs.yaml&stackName=vpc" target="_blank">here.</a> We don't need to make any changes to the settings for this first stack. If the installation of this stack is completed without encountering any errors, it means that we can proceed to the installation of the other template.

You can install the second template directly from <a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://s3-eu-west-1.amazonaws.com/widdix-aws-s3-virusscan/template.yaml&stackName=s3-virusscan&param_ParentVPCStack=vpc" target="_blank">here.</a> I performed these installations in the us-east-1 (N. Virginia) Region.

<img src="/assets/blog-photos/s3-antivirus/stack-2-installation.png" class="imgCenter" alt="Stack Installation">

There is no need to explain each setting in this area one by one. Clear explanations have already been made. I just continued by changing the **InstanceType** value under EC2 Parameters from t2.small to t2.micro. You can also change other settings according to your preference. If this resulted in CREATE_COMPLETE on the stack, great! We can continue on our way.

<img src="/assets/blog-photos/s3-antivirus/s3-av-stack-complete.png" class="imgCenter" alt=“Stack Installation Complete”>

Now we need to make some settings from the S3 Bucket that we want to be scanned. I created a test Bucket named s3-virus-scan-bucket in the same Region. In case a new object is uploaded to this Bucket, we need to create a new Event so that it can be scanned and the relevant actions can be taken. For this, we click the "Create event notification" button from the **Event Notification** field under the **Properties** tab. In the **Event Type** field, you need to select the "All object create event" option. In the **Destination** field, you have to choose SQS Queue and choose the **non-DLQ** option at the end. You can see this area in the picture below.

<img src="/assets/blog-photos/s3-antivirus/s3-av-s3-event-sqs.png" class="imgCenter" alt=“S3 Bucket SQS Event”>

You can record the Event without making any other settings. From this point on, every object uploaded to the relevant S3 Bucket will be first scanned by ClamAV, if there is no harmful content, the relevant file will be stored in the Bucket, if there is any harmful content, the relevant file will be deleted.

Finally, let's make the relevant settings to receive e-mail notification via SNS in case of a malicious file upload and test the system we have created. You will see that a new Topic is automatically created under the **SNS** service. All we have to do is create a new Subscription for this Topic. Just click the "Create subscription" button and then choose E-Mail as Protocol to continue. There will be no other adjustments you need to make. Finally, confirm the Subscription Confirmation e-mail sent to the e-mail address you provided.

### Test
Everything is ready now. We can test the system. For this, I upload a harmless txt file called justAtxt and two file called malware.ex_ and AzorultPasswordStealer.bin which is known to be harmful. The malware.ex_ file is a file belonging to the Stuxnet malware and the AzorultPasswordStealer.bin file is a file belonging to the Azorult Stealer. So they are quite popular.

<img src="/assets/blog-photos/s3-antivirus/s3-av-files-upload.png" class="imgCenter" alt=“S3 File Upload”>

Just a few seconds after uploading the relevant files, I see that I receive mail via SNS.

<img src="/assets/blog-photos/s3-antivirus/s3-av-sns-mail.png" class="imgCenter" alt=“Malicious File Mail Notification”>

In addition, when we look at the S3 Bucket, where we upload the files, we see that the related files have been deleted, but our harmless file is still with us. While installing the CloudFormation Template, you can specify settings such as not deleting the uploaded files even though they are harmful, scanning only, notifying them by mail, and tagging harmful files.

## Detection of Malicious File Uploaded to S3 Buckets with ClamAV (Another Way)
While researching on this subject, I came across a very nice open-source project (<a href="https://github.com/bluesentry/bucket-antivirus-function" target="_blank">bucket-antivirus-function</a>). This project allows scanning of new objects uploaded to S3 Buckets with the help of AWS Lambda. This tool scans files uploaded to S3 with ClamAV and deletes them if they contain harmful content. With the CloudFormation Template can be installed quite easily with a few manual steps. You can check the GitHub Repo for detailed information and installation stages.

## Detection of Malicious File Uploaded to S3 Buckets with Trend Micro Cloud One
Trend Micro Cloud One is a paid solution. You can use Trend Micro Cloud One Yu not only to scan files uploaded to S3 Buckets but also as a security solution at many points related to your cloud environments. I cannot give a positive or negative comment as I have not used this product except for a few PoCs and demos. I wanted to include it in the scope of Blogpost as it provides a solution to our problem. Briefly, the working structure of Cloud One is explained in the image below. (Screenshot taken from Trend Micro documentation.)

<img src="/assets/blog-photos/s3-antivirus/trend-micro-cloud-one-s3-av.png" class="imgCenter" alt=“Trend Micro Cloud One S3 Antivirus”>

In addition, the Cloud One platform has a wider variety of capabilities. You can find detailed information <a href="https://aws.amazon.com/blogs/apn/amazon-s3-malware-scanning-using-trend-micro-cloud-one-and-aws-security-hub/" target="_blank">here</a>.

## Detection of Malicious File Uploaded to S3 Buckets with Kaspersky Scan Engine
Kaspersky Scan Engine is a paid solution just like Trend Micro Cloud One. This platform can scan objects uploaded to S3, as well as to detect insecure configurations in Kubernetes and Docker configurations, and scan a wider variety of cloud platforms. You can find detailed information <a href="https://www.kaspersky.com/scan-engine" target="_blank">here</a>.

## Detection of Malicious File Uploaded to S3 Buckets with Cloud Storage Security
Products are available on the AWS Marketplace of <a href="https://aws.amazon.com/marketplace/seller-profile?id=6ca3cdf7-b551-4872-b1cf-2f818b397df3&ref=dtl_B089QBV2GC" target="_blank">Cloud Storage Security</a>. This product can tag, delete or quarantine scanned malicious items just like any other product. In addition, findings from API-driven, real-time, and scheduled scans are published on the AWS Security Hub. These AV products of Cloud Storage Security are also paid. But there are also free trial versions.

## Detection of Malicious File Uploaded to S3 Buckets with Scanii
Another paid solution is <a href="https://scanii.com/" target="_blank">Scanii</a>. Scanii can scan for vulnerabilities on S3 Bucket with the help of AWS Lambda. It is very simple to set up and use.

## Detection of Malicious File Uploaded to S3 Buckets with BinaryAlert
According to its own explanations, <a href="https://www.binaryalert.io/" target="_blank">BinaryAlert</a>;
> BinaryAlert is a serverless, real-time framework for detecting malicious files. Organizations can deploy BinaryAlert to their AWS account in a matter of minutes, allowing them to analyze internal files and documents within the confines of their own environment.

Since it has very detailed documentation, it can be easily installed and used.

## Detection of Malicious File Uploaded to S3 Buckets ClamAV and CDK
While doing my research, I came across a <a href="https://aws.amazon.com/blogs/developer/virus-scan-s3-buckets-with-a-serverless-clamav-based-cdk-construct/" target="_blank">blogpost</a> from AWS. By using aws-cdk it satisfies the need we mentioned. You can find detailed information in the related blog post. The working logic is illustrated in the image below.

<img src="/assets/blog-photos/s3-antivirus/serverless-clamscan.png" class="imgCenter" alt=“Serverless ClamScan”>

## Feedback
In addition to all these, I recommend you to follow the steps in the <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html" target="_blank">Security Best Practices for Amazon S3</a> document published by Amazon. This was the first article I wrote in English. So, if there are points that I have mistranslated, please do not be offended. You can contact me through any channel on any technical and/or non-technical issue.