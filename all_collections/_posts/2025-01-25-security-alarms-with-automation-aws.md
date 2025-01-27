---
layout: post
title: Managing Security Alarms with Automation in AWS
date: 2025-01-25
tag: aws, aws security, security automation, aws security alarms, aws security automation
categories: general
permalink: managing-security-alarms-with-automation-in-aws
published: true
lang: en
---

# Managing Security Alarms with Automation in AWS
## TLDR;
Automated detection of security threats and taking necessary actions are some of the most important key points today. With the attack surface expanding day by day, the topics that need to be checked regularly are also increasing. At this point, it is critical to build, design, and maintain automated systems as well as manual controls and human power. AWS has various security services that allow us to perform some security checks on a regular basis. Using these services more efficiently depends on the architecture we will design depending on the structure of our organization. In this blog post, I will take some security alarms that we think may be harmful in AWS by using AWS's security services and take automatic actions thanks to Lambda.

## What Will We Automate?
- Detection and Automated Action of AWS CloudTrail Deactivation

## What Else Can You Automate?
- Abnormal Pod Incidents to the EKS
- Unexpected Traffic Increase on EC2
- Detection of Abnormal Activity of an IAM User
- Disabling Encryption Settings on RDS
- Automatic Check and Correction of S3 Bucket Encryption Status
- Detect IAM Root User Usage and Send Alarm
- Controlling EC2 Instance Security Groups
- IAM High Authority Role Monitoring
- And much more

### Detection and Automated Action of AWS CloudTrail Deactivation
When attackers gain unauthorized access through the interface or CLI, there are some steps they will take. One of them will be to erase the traces they have left behind. The first method they will try for this will be to deactivate CloudTrail if it is active. In this example, we will check whether CloudTrail is active or not in an automated way and reactivate it if it is deactivated. Of course, the task of activating CloudTrail also falls to our automation.

My goal here is to give you an overview of how you can build mini security automations in AWS, rather than having you do these examples in person.

At the end of the day, our architecture will look like this:
<img src="/assets/blog-photos/security-alarms-with-automation/architecture.png" class="imgCenter" alt="AWS CloudTrail Deactivation Automation Architecture">

#### Enable cloudtrail-enabled Rule in AWS Config
First of all, we need to activate the **AWS Config** service. I skip the part on how to activate AWS Config and continue my article in the scenario where it is already active. We need to check whether CloudTrail is active on AWS Config. For that from the left menu we have to go to **Rules** and **Add Rule**. By selecting **AWS Managed Rule**, we select **cloudtrail-enabled** or **multi-region-cloudtrail-enabled** and create our rule.
> We could have created the automation for this scenario by listening to CloudTrail calls directly on EventBridge without using AWS Config. I added this step so that you can see different scenarios.

<img src="/assets/blog-photos/security-alarms-with-automation/aws-config-cloudtrail-enabled.png" class="imgCenter" alt="AWS Config cloudtrail-enabled Rule">

#### Automatic Response with Lambda Function
We need the Lambda function to take the automatic action if CloudTrail is deactivated. The code we will write here will be quite simple. Of course, you may need to improve your code depending on the needs of the organization. For this, we will of course create an IAM role, create our Lambda function, and add the IAM code to this Lambda function. (Spoiler: Yes! We will then use EventBridge to trigger the Lambda function).

Before we start creating the Lambda function, we will need to create an IAM role to give the Lambda function the authorizations it needs to make the necessary changes to CloudTrail. You can also use <a href="https://awspolicygen.s3.amazonaws.com/policygen.html" target="_blank">AWS's IAM Role Generator</a> to create an IAM role.

For this, you must follow these steps on the IAM screen:
- Go to IAM > Policies > Create Policy

> Make sure to comply with the least privilege policy when creating a new IAM role. This could prevent further security problems. Here, we will create our authorization instead of authorizing our role such as AdministratorAccess.

- Here is what our policy looks like:

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudtrail:UpdateTrail",
                "cloudtrail:StartLogging",
                "cloudtrail:DescribeTrails",
                "lambda:InvokeFunction",
                "cloudtrail:GetTrailStatus"
            ],
            "Resource": "*"
        }
    ]
}
```

You can customize the Policy according to your needs.

- Create the policy.
- Go to IAM > Roles.
- Select AWS Service as Trusted entity type and proceed by selecting Lambda in the Use case field just below.
- In the Permission policy tab, let's assign the role by selecting the Policy we just created and complete the new role creation step.

Finally we can create our Lambda function. I will create the Lambda function in Python 3.x. You can of course use any other programming language that suits you or that you are comfortable with. Anyway, it is up to you to improve and extend the code here according to your needs. Here is my PoC code:

```Python
# Import the required libs
import json
import boto3
import logging
from botocore.exceptions import ClientError

# Making logging settings
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    # Create a client to access the AWS CloudTrail service
    cloudtrail = boto3.client('cloudtrail')
    
    try:
        # Log the incoming event
        logger.info(f"Received event: {json.dumps(event)}")
        # List all CloudTrails in the account
        response = cloudtrail.describe_trails()
        
        # If there is no trail, return an error
        if not response['trailList']:
            logger.warning("No CloudTrail trails found in the account")
            return {
                'statusCode': 404,
                'body': 'No CloudTrail trails found'
            }
        
        # Perform operations for each trail
        for trail in response['trailList']:
            trail_name = trail['Name']
            
            try:
                # Checking the current status of the trail
                status = cloudtrail.get_trail_status(Name=trail_name)
                
                # If logging is closed then do them
                if not status['IsLogging']:
                    logger.info(f"Trail {trail_name} is disabled. Enabling it...")
                    
                    # Activate the Trail
                    cloudtrail.start_logging(Name=trail_name)
                    
                    logger.info(f"Successfully enabled trail: {trail_name}")
                else:
                    logger.info(f"Trail {trail_name} is already enabled")
                    
            except ClientError as e:
                # If an error occurs while activating a trail, we continue with other trails
                logger.error(f"Error processing trail {trail_name}: {str(e)}")
                continue
        
        return {
            'statusCode': 200,
            'body': 'Successfully processed all trails'
        }
        
    except ClientError as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': f"Error: {str(e)}"
        }
```

#### Event Triggering with EventBridge
We need to connect the Lambda function to an Event via EventBridge to automatically take action when the case we expect occurs. For this let's create a new event. While creating our rule, we select the **Config Rules Compliance Change** option in the Sample event section. As the creation method, we will write our own rule by selecting Custom pattern again. Our rule will be as follows:

For this scenario, we want to trigger the Lambda function we wrote to recognize when a Trail is stopped. We need to create our EventBridge rule as follows:
- You can fill in the Event name field as you wish.
- In our scenario here, the Rule Type field should be **Rule with an event pattern.**
- On the next page we must select **Other** in the **Event Source** field.
- On the Build event pattern page, we can go down to the bottom and write our rule in the Event pattern field just below by making the **Creation method** **Custom pattern** without changing any other settings.
- You can write the following code in the event pattern field:

```JSON
{
  "source": ["aws.config"],
  "detail-type": ["Config Rules Compliance Change"],
  "detail": {
    "configRuleName": ["cloudtrail-enabled"],
    "newEvaluationResult": {
      "complianceType": ["NON_COMPLIANT"]
    }
  }
}
```

> I can say that the writing format of Event Patterns is very clear and simple. If you have more questions about writing Custom Event Patterns, you can check AWS's official documentation..

- Select the **AWS service** radio button as the target and then select the **Lambda function** in the Select a target section and the Lambda function we have prepared in the Function section.
- Create the rule.

The EventBridge Rule summary we created should look like this:
<img src="/assets/blog-photos/security-alarms-with-automation/eventbridge-review.png" class="imgCenter" alt="EventBridge Rule Review">

That's all. Now we have a mini automation that will reactivate any of the CloudTrail Trails in case any of them is deactivated. Of course, you can also develop different solutions specific to your organization. For example:
- If you have Trails that should not be included in this automation, you can create an Exception list and develop your code accordingly.
- When the automation runs, you can send an e-mail containing information such as the Trail name, the user who deactivated the Trail, the time when the Lambda function was triggered.
- You can visualize the logs of all these operations by sending them to ELK.

#### Test
Just deactivate an existing Trail. After a short time, you will see that the Trail has been reactivated. You can also observe your test by following these metrics after deactivating your Trail:
- You can observe whether your Lambda code is triggered or not from CloudWatch Log groups.
- You can observe your EventBridge metrics.

Also after a while you have to see Noncompliant Warning on the AWS Config.

<img src="/assets/blog-photos/security-alarms-with-automation/aws-config-cloudtrail-non-compliant.png" class="imgCenter" alt="AWS CloudTrail Noncompliant Warning">

> In fact, we could have triggered our Lambda function by selecting the Create custom Lambda rule option while creating our Config Rule without using EventBridge. I would like to state again that my goal here is to provide you with different perspectives. There are many different ways to create such mini security automations on AWS. Of course, you can create the most suitable architecture according to your needs and by getting to know AWS services.

## Last Word
In this blog post, my goal was to give you a perspective on how you can set up mini automations to make your AWS environment more secure. I strongly encourage you to try building the other automations in the "What Else Can You Automate?" section or develop the automations mentioned in this blog post.

Depending on your business needs, the automations you can build will vary and change. The code you write may change and the AWS services you use may change.

If you have any suggestions for the article, please feel free to contact me through any communication channel (Linkedin, Twitter, Threema, etc.). I am constantly updating the articles in line with your feedback.