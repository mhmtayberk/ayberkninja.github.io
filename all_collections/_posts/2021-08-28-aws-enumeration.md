---
layout: post
title: Bulutlara Dokunmak ☁️ - AWS/Enumeration
date: 2021-08-28
tag: aws, aws enum, aws recon, aws enumeration, cloud security, cloud recon
categories: general
permalink: aws-enumeration
published: true
---

Herkese selamlar. Yaklaşık bir asır sonunda yeniden motivasyonumu toparladım ve bir blog serisine başlamak istedim. Bu blog serisinde sizlere AWS tarafındaki enumeration, exploitation ve post-exploitation aşamalarından bahsedeceğim. Bu blog serisi boyunca AWS ve bulut bilişim ile ilgili detaylı bilgiler olmayacak. Doğrudan bulut bilişimin güvenliği ile ilgileniyor olacağız. Elbette temel ihtiyaçlarımızı tanıtıyor da olacağız. Bu yazıda yalnızca AWS tarafından ve enumeration işlemlerinden bahsediyor olacağım. Örnek uygulamalar noktasında zafiyetli bir bulut hizmeti olan <a href="http://flaws.cloud/" target="_blank">Flaws Cloud'u</a> kullanacağım. Lafı fazla uzatmadan konumuza bir girizgah yapalım.

# Ön Hazırlık
AWS noktasında güvenlik üzerine konuşabilmek için bilmemiz gereken bazı kavramlar olacak. Bu kavramlardan kısaca bahsedelim. Birazdan bahsedeceğim kavramlarla ilgili daha detaylı bilgi edinmek istemeniz durumunda <a href="https://aws.amazon.com/tr/" target="_blank">AWS'nin resmi dokümantasyonuna</a> göz atabilirsiniz.

## IAM Nedir?
IAM (Identity and Access Management), AWS'nin tarafınıza sunmuş olduğu hizmetlere olan erişimleri denetlemenizi sağlamaktadır. Doğrudan AWS'nin tanımına göre IAM;

>AWS Identity and Access Management (IAM), AWS hizmetlerinize ve kaynaklarınıza erişimi ve ilgili izinleri denetlemenizi sağlar. IAM sayesinde, kullanıcılarınıza ve uygulamalarınıza verdiğiniz izinleri yönetebilir, bir AWS hesabına erişimi yönetmek için kimlik federasyonundan yararlanabilir ve kaynaklara ve hizmetlere erişimi analiz edebilirsiniz.

## S3 ve S3 Bucket Kavramı
S3 (Simple Storage Service) en kaba tabiri ile ölçeklenebilir içerik depolama ve dağıtım servisidir. Boyutu fark etmeksizin her türlü veriyi depolama ve servis etmek için AWS'nin S3 servisi kullanılabilir. IOT, büyük veri, mobil uygulamalar, web siteleri ve aklınıza gelebilecek pek çok alanda S3 servisini kullanabilirsiniz. <br>
S3 servisi depoladığınız verileri nesneler olarak Bucket'lar içerisinde tutmaktadır. Yani Bucket'lar S3 servisi üzerinde depolamak istediğiniz verilerin saklandığı ve bu verilere erişimin sağlandığı alandır.

## EBS Nedir?
AWS'nin sunmuş olduğu tek içerik depolama servisi S3 değildir. EBS (Elastic Block Store) isminden de anlaşılabileceği üzere AWS'nin kullanıma sunmuş olduğu bir başka içerik depolama servisidir. AWS'nin söylediğine göre Amazon Elastic Compute Cloud (EC2) ile birlikte kullanılmak için tasarlanmış bir veri depolama servisidir. S3 ile EBS arasındaki en büyük farklardan biri EBS'nin yalnızca bağlı olduğu "instance" üzerinden erişilebilir olmasıdır.

## EC2 Nedir?
EC2 (Elastic Compute Cloud)'yi aslında her gün kullanmakta olduğumuz sanal makineler olarak düşünebiliriz. EC2 içerisinde çeşitli ihtiyaçlar için hazırlanmış sanal makineler (AMI) de bulunmaktadır. Bu makineler birkaç tıklama ile birkaç saniye içerisinde kullanıma hazır hale gelmektedir.

## Lambda Nedir?
AWS Lambda, Vikipedi'ye göre;
> Amazon tarafından sağlanan olay odaklı, sunucusuz bir bilgi işlem platformudur. Olaylara yanıt olarak kod çalıştıran ve bu kodun gerektirdiği bilgi işlem kaynaklarını otomatik olarak yöneten bir bilgi işlem hizmetidir.

## AWS CLI Nedir?
AWS CLI (Command Line Interface), AWS üzerindeki varlıklarınızı komut satırı aracılığı ile yönetmenizi sağlayan gelişmiş bir araçtır. AWS CLI ile pek çok işlemi gerçekleştirebiliriz. Ayrıca enumeration aşamasında da bu aracı kullanacağız.

# Enumeration
Kabaca temel bilgileri edindiğimize göre enumeration aşamalarına yavaş yavaş geçebiliriz. Bu noktada belirtmeliyim ki eğer Authenticated iseniz toplayabileceğiniz bilgiler çok daha geniş olacaktır. Ben bu blogpostta Authenticated Enum, Unauthenticated Enum şeklinde bir ayrımda bulunmayacağım.

## Domain Üzerinde AWS Kullanımını Öğrenmek
Authenticated olmadan yapabileceğiniz bir işlem. Bir domain üzerinde AWS kullanılıp kullanılmadığını öğrenebiliriz. Bunun en basit yöntemlerinden biri Linux sistemlerde varsayılan olarak gelen host komutunu kullanmaktır. Reverse DNS lookup yaparak **host** komutu ile bir alan adının AWS arkasında olup olmadığını öğrenebiliriz. Aşağıdaki görselde bir örnek görmektesiniz;
<img src="/assets/blog-photos/aws-enumeration/aws-enum-host.png" style="text-align: center;" alt="Host Command">

Aynı işlemi **nslookup** ve **dig** komutları ile yapmakta mümkün. Ayrıca yukarıdaki görseli dikkatli incelerseniz aslında Bucket'ın Region'ını da öğrenmiş olduk. Buradan yola çıkarak AWS CLI aracı ile daha çeşitli bilgiler elde edebiliriz.
```sh
aws s3 ls  s3://flaws.cloud/ --no-sign-request --region us-west-2
```
Yukarıdaki komutta görmüş olduğunuz üzere AWS CLI aracını kullanarak Region'ı da bildiğimizi varsayarak ilgili Bucket üzerindeki dosyaları görmeye çalışıyoruz.
<img src="/assets/blog-photos/aws-enumeration/aws-s3-ls.png" style="text-align: center;" alt="AWS CLI S3 ls Command">

> Bu noktada şunu belirtmekte fayda var. Bir domain üzerinde yukarıdaki yöntemlerle herhangi bir geri dönüş alamamış olabilirsiniz. Bu her zaman ilgili alan adının AWS üzerinde olmadığı anlamına gelmez. Varsayılan olarak S3 Bucket'ları güvenlidir. Ancak bu S3 Bucket'ları herkes tarafından erişilebilecek şekilde ve nesnelerin dışarıdan okunmaya, yazılmaya izin verilecek şekilde yapılandırılabilirler.

Eğer elinizde bir AWS key varsa bu key ile aşağıdaki komutu kullanarak tüm S3 Bucket'ları listeleyebilirsiniz;
```sh
aws s3 ls --profile namehere
```

## GitHub Üzerinden S3 Varlıklarını Tespit Etmek
GitHub üzerinden hard-coded verileri tespit etmek yeni bir yöntem değil. Bulut tarafı için konuşacak olursak yine S3 varlıklarını ve daha çeşitli hard-coded verileri GitHub üzerinden tespit edebiliriz. Bir örnek olarak GitHub üzerinde aşağıdaki şekilde arama gerçekleştirelim.
 ```sh
flaws.cloud amazonaws.com
```
<img src="/assets/blog-photos/aws-enumeration/aws-creds-github.png" style="text-align: center;" alt="AWS Hard-Coded Data on GitHub">

Bu şekilde ilgili alan adına ait S3 Bucket'ları tespit edilebilir. Bu işlemi <a href="https://github.com/zricethezav/gitleaks" target="_blank">GitLeaks</a> vb. araçlar ile otomatize hale getirebilirsiniz.

Ek olarak aşağıdaki gibi aramalar sonucunda da hard-coded verileri elde etmeniz mümkün olacaktır;
 ```sh
“flaws.cloud” API_key
“flaws.cloud” secret_key
“flaws.cloud” aws_key
“flaws.cloud” AWS_ACCESS_KEY_ID
“flaws.cloud” PROD_AWS_ACCESS_KEY_ID
“flaws.cloud” PROD_AWS_SECRET_ACCESS_KEY
“flaws.cloud” AWS_ROLE_TO_ASSUME
“flaws.cloud” AWS_ROLE_EXTERNAL_ID
“flaws.cloud” arn:aws:iam
```

Yukarıdaki örnekler çoğaltılabilir.

## Gray Hat Warfare
<a href="https://buckets.grayhatwarfare.com/" target="_blank">Gray Hat Warfare</a> internet üzerindeki Public Bucket'ları depolayan ve listeleyen bir veritabanıdır. Gray Hat Warfare üzerinden de çeşitli sorgular yapabilir ve bilgi toplayabilirsiniz.

## Burp Suite ile S3 Varlıklarının Tespiti
Web pentest sırasında elimiz ayağımız olan Burp Suite aracılığı ile S3 Bucket'ların tespiti de mümkün. Bunu dilersek Burp üzerine Extension kurarak, dilersek ise Regex yardımı ile herhangi bir Extension kurmadan yapabiliriz. Örneğin BApp Store üzerinde bulunan <a href="https://portswigger.net/bappstore/04adbe101f544c88b2497a9a25ffaab4" target="_blank">Cloud Storage Tester</a> eklentisi ile veya BApp Store üzerinde doğrudan bulunmayan <a href="https://github.com/VirtueSecurity/aws-extender" target="_blank">AWS Extender</a> eklentisi ile bu işlemi yapmak mümkün. Veya aşağıdaki gibi bir Regex ile bu işlemi gerçekleştirebilirsiniz;
 ```sh
[\w\-\.]+\.s3\.?(?:[\w\-\.]+)?\.amazonaws\.com|(?<!\.)s3\.?(?:[\w\-\.]+)?\.amazonaws\.com\\?\/[\w\-\.]+
```

## Google Dork'lar İle S3 Varlıklarını Tespit Etmek
S3 Bucket varlıklarını tespit etmenin bir diğer basit ve etkili yolu ise Google Dork'lardır. Örnek olarak;
 ```sh
site:s3.amazonaws.com flaws.cloud
```

İlgili arama sonuçlarından yola çıkarak S3 Bucket'ı tespit edebildiğimizi görüyorsunuz.
<img src="/assets/blog-photos/aws-enumeration/aws-s3-find-google.png" style="text-align: center;" alt="S3 Bucket Find With Google Dorks">

Bunların haricinde aşağıdaki Google Dork'ları da kullanabilirsiniz ve daha çeşitli pek çok Google Dork oluşturabilirsiniz;
 ```sh
site:s3.amazonaws.com example
site:s3.amazonaws.com example.com
site:s3.amazonaws.com example-com
site:s3.amazonaws.com com.example
site:s3.amazonaws.com com-example
site:s3.amazonaws.com filetype:xls password
site:http://s3.amazonaws.com intitle:index.of.bucket
site:http://amazonaws.com inurl:".s3.amazonaws.com/"
```

## Censys İle S3 Bucket'larının Tespiti
<a href="https://search.censys.io/" target="_blank">Censys</a> üzerinden yine public S3 Bucket'larını tespit etmek mümkün olacaktır. Bu tarafta anlatılacak çok fazla konu yok. Kullanımı oldukça basit.
<img src="/assets/blog-photos/aws-enumeration/aws-s3-find-censys.png" style="text-align: center;" alt="S3 Bucket Find With Censys">

## AWS Kullanıcıları İle İlgili Bilgi Toplama
Eğer elinizde private AWS key varsa veya bir şekilde bu key'i bulduysanız kullanıcılar ile ilgili çeşitli bilgilere sahip olabilirsiniz. Bunun için yine AWS CLI aracını kullanacağız. AWS CLI aracını öncesinde yapılandırmanız gerekecek. Bu işlemi doğrudan **aws configure** diyerek yapabilirsiniz. Fakat biz aşağıdaki komutu kullanalım;
```sh
aws configure --profile namehere
```

Bu komut "namehere" adında yeni bir profil oluşturacak. Kullanıcıların sahip olduğu policy'leri görüntülemeye çalışalım. Bunun için öncelikle aşağıdaki komut yardımıyla ilgili kullanıcının PolicyArn değerini öğreneceğiz.
 ```sh
aws iam list-attached-user-policies --profile <Profile> --user-name <UserName>
```

Buradan elde etmiş olduğumuz değeri aşağıdaki komut ile kullanarak ilgili kullanıcının policy'lerini görüntülemiş olacağız;
 ```sh
aws iam get-policy --profile <PROFILE> --policy-arn <POLICY_ARN>
```

AWS Access Key'i üzerinden Account ID'sini öğrenmek için ise aşağıdaki komut kullanılabilir;
 ```sh
aws sts get-access-key-info --access-key-id=<KEY_HERE>
```

Elbette burada KEY_HERE dediğimiz alana Access Key gelecek.

## Public EC2 Snapshot'larının Tespiti
EC2 instance'larının zaten sanal makinelerden aşina olduğumuz biçimde Snapshot'ları alınabilmektedir. Bu Snapshot'lar **public** olarak bırakıldığı takdirde herkes tarafından erişilebilmektedir. Public bırakılan Snapshot'ları kendi EC2 sunucularınıza bağlayabilirsiniz. Tahmin edebileceğiniz üzere bu oldukça kritik bir durumdur. İlgili Snapshot'lar hakkında Authenticated olduğumu varsayarak bilgi toplayalım.
 ```sh
aws  ec2 describe-snapshots --profile flawscloud --owner-id 975426262029 --region us-west-2
```
<img src="/assets/blog-photos/aws-enumeration/aws-cli-ec2-enum.png" style="text-align: center;" alt="EC2 Enumeration With AWS CLI">

Burada **owner-id** değeri daha önce profil üzerinde yapmış olduğumuz enumeration işleminden elde ettiğimiz Arn üzerindeki değerdir. Öte yana bir Region belirtmemiz gerektiğini muhtemelen zaten fark ettiniz. Bu komut bize çıktı olarak JSON formatında public olarak mount edilebilir Snapshot'ların bir listesini verecektir.

İlgili Snapshot'ları kendi EC2 sunucularımıza bağlama işlemini Exploitation başlığı altında detaylı olarak ele alacağız.

# Otomatize Araçlar
Elbette tüm bu bilgi toplama aşamalarını ve çok daha fazlasını gerçekleştirebileceğimiz otomatize araçlar da mevcut. Bu araçların bazılarından detaya girmeden bahsedelim. Zaten bu araçlardan bazılarını Exploitation ve Post-Exploitation aşamalarında daha detaylı olarak ele alacağız.

## lazys3
<a href="https://github.com/nahamsec/lazys3" target="_blank">lazys3</a> aracı AWS S3 Bucket'larını tespit etmenize olanak tanıyan bir araçtır. 

## cloud_enum
<a href="https://github.com/initstring/cloud_enum" target="_blank">cloud_enum</a> AWS, Azure ve Google Cloud üzerindeki Public kaynakların tespiti için kullanılan bir araçtır. Örnek çıktı aşağıdaki gibidir;
<img src="/assets/blog-photos/aws-enumeration/cloud-enum-tool.png" style="text-align: center;" alt="Cloud Enum Tool">

## enumerate-iam
<a href="https://github.com/andresriancho/enumerate-iam" target="_blank">enumerate-iam.py</a> elinizde Access Key ve Secret Key olması durumunda IAM üzerinde çok çeşitli bilgileri ortaya çıkaran bir araçtır. IAM'in ne olduğunu zaten blogun başında anlatmıştım. Bu araç aslında vermiş olduğunuz Access Key ve Secret Key ikilisine ait kullanıcının yetkilerini ortaya çıkarıyor.
<img src="/assets/blog-photos/aws-enumeration/iam-bruteforce.png" style="text-align: center;" alt="IAM Bruteforce Tool">

## Diğer Araçlar
Bulut güvenliği ile ilgili daha geniş bir araç setine <a href="https://github.com/toniblyx/my-arsenal-of-aws-security-tools" target="_blank">buradaki GitHub Repo'su</a> üzerinden erişebilirsiniz. ScoutSuite, Prowler gibi All In One araçları bir sonraki yazılarımızda detaylı ele alıyor olacağız.

## Geri Bildirim
AWS üzerinde Enumeration işlemlerini anlattığım blog yazısı bu kadardı. Exploitation ve Post-Exploitation aşamalarında görüşmek üzere. Herhangi bir geri bildiriminiz olması durumunda benimle herhangi bir iletişim kanalı (Twitter, Threema vb.) üzerinden iletişime geçebilirsiniz.
