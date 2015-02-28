//The following are Class Variables that gets initiated with when the window is loaded. 
var patientCell;
var patientEmail; 
var ecnt;
var initiated = false;

//On load, initiate the EmailTextEngine variables
window.addEventListener("load",function(){
  startETEngine();
});

function openForm(formName){
  var pathArray = window.location.pathname.split( '/' );
  var newURL = window.location.protocol + "//" + window.location.host +"/"+pathArray[1]+"/eform/efmformslistadd.jsp?demographic_no="+getDemoNo();
  var eFormListWindow = window.open(newURL);

  eFormListWindow.addEventListener("load", function(){
    var a_array = this.document.links;
    for(var i=0;i<a_array.length;i++){
      var a = a_array[i];
      if(a.innerHTML.indexOf(formName)>-1){
        a.click();
        eFormListWindow.close();
        return;
      }
    }
  }, false);
}

function openConsentForm(){
  openForm("Email Text Consent Form");
}

// sending an email through Mandrill, needs an API key from www.mandrill.com
function sendEmail(newsubject, newbody){
  if(!initiated)
    startETEngine();

  var m = new mandrill.Mandrill(get_mandrill_api_key());

  if(!emailConsented()){
    alert("No email consent");
    return;
  }

  var confirmSend = confirm("Sending: \""+newbody+"\" to "+patientEmail);
  if(!confirmSend){
    return;
  }

  var params = {
    "message": {
      "from_email":get_sender_email(),
      "to": [
            {
                "email": patientEmail,
                "type": "to"
            }
        ],
      "subject": newsubject,
      "text": newbody
    }
  };
  m.messages.send(params, function(res){
    if (res[0]["status"]=="sent"){
      alert("Email sent to "+patientEmail+". Message: "+newbody);
    }
  }, function(err){
    console.log(err);
    alert("Email send error:"+err);
  });
}

function sendText(body){
  if(!initiated)
    startETEngine();

  if(!textConsented()){
    alert("No text consent");
    return;
  }

  var confirmSend = confirm("Sending: \""+body+"\" to "+patientCell);
  if(!confirmSend){
    return;
  }

  var twilio_id = get_twilio_id();
  var twilio_auth = get_twilio_auth();
  var url = "https://"+twilio_id+":"+twilio_auth+"@api.twilio.com/2010-04-01/Accounts/"+twilio_id+"/Messages";

  var form = document.createElement("form");
  form.setAttribute("method", "POST");
  form.setAttribute("action", url);
  form.target = "hiddenFrame";

  var fromField = document.createElement("input");
  fromField.type = "hidden";
  fromField.name = "From";
  fromField.value = get_twilio_number();
  form.appendChild(fromField);

  var toField = document.createElement("input");
  toField.type = "hidden";
  toField.name = "To";
  toField.value = patientCell;
  form.appendChild(toField);


  var bodyField = document.createElement("input");
  bodyField.type = "hidden";
  bodyField.name = "Body";
  bodyField.value = body;
  form.appendChild(bodyField);

  document.body.appendChild(form);

  var hiddenFrame = document.createElement("iframe");
  hiddenFrame.name = "hiddenFrame";
  hiddenFrame.setAttribute("hidden",true);
  document.body.appendChild(hiddenFrame);

  form.submit();
}

// getting the email from the patient's demographic data page
function getPatientEmailAndText(){
  var xmlhttp= new XMLHttpRequest();
  var pathArray = window.location.pathname.split( '/' );
  var newURL = window.location.protocol + "//" + window.location.host +"/"+pathArray[1]+"/demographic/demographiccontrol.jsp?displaymode=edit&dboperation=search_detail&demographic_no="+getDemoNo();
  xmlhttp.onreadystatechange=function(){
    if (xmlhttp.readyState==4 && xmlhttp.status==200){
      var str=xmlhttp.responseText; 
      if (!str) { return; }
      var myRe = /Email:<\/span>\n\s*<span class="info">(.*)<\/span>/i;  
      var myArray;
      var i=0;
      if((myArray = myRe.exec(str))!== null){
        patientEmail = myArray[1];
      }   
      myRe = /Cell Phone:<\/span>\n\s*<span class="info">(.*)<\/span>/i;
      if((myArray= myRe.exec(str))!==null){
        patientCell = makeTwilioFriendly(myArray[1]);
      }
    }
  }
  xmlhttp.open("GET",newURL,false);
  xmlhttp.send();
}

function getPatientEmail(){
  if(patientEmail==null)
    getPatientEmailAndText();
  return patientEmail;
}

// finding the demographic number for the current patient by looking in the URL of this lab form
function getDemoNo(){
  var myRe0 = /demographic_no=(\d*)[&^]/g;
  var myRe1 = /demographicNo=(\d*)[&^]/g;
  var myRe2 = /demo=(\d*)[&^]/g;
  var results0 = myRe0.exec(document.URL);
  var results1 =  myRe1.exec(document.URL);
  var results2 =  myRe2.exec(document.body.innerHTML);

  var myArray = results0 || results1 || results2;

  var demoNo = myArray[1];
  return demoNo;
}

// Initiating the EmailTextEngine. 
function startETEngine(){
  //If it has been iniated already, do nothing further
  if(initiated)
    return;
  
  //Inserting javascripts from the Image Library to the head of the page that is loading the EmailTextEngine.
  var head = document.getElementsByTagName("head")[0];
  var pathArray = window.location.pathname.split( '/' );
  
  var newURL = window.location.protocol + "//" + window.location.host +"/"+pathArray[1]+"/eform/displayImage.do?imagefile=mandrill_nostringify.js";
  var mandrill_script = document.createElement('script');
  mandrill_script.type = 'text/javascript';
  mandrill_script.src = newURL; 
  head.appendChild(mandrill_script);

  newURL = window.location.protocol + "//" + window.location.host +"/"+pathArray[1]+"/eform/displayImage.do?imagefile=emailtextengine_credentials.js";
  var credential = document.createElement('script');
  credential.type = 'text/javascript';
  credential.src = newURL;
  head.appendChild(credential);

  //Initiating patient's contact information and consent information
  getPatientEmailAndText();
  getECNTMeasurement();

  //Finding all EmailTextEngine buttons on the page
  var emailButtons = document.getElementsByName("EmailButton");
  var textButtons = document.getElementsByName("TextButton");
  var consentButtons = document.getElementsByName("ConsentButton");

  //For the EmailButtons
  for(var i=0;i<emailButtons.length;i++){
    var emailButton = emailButtons[i];
    //If it does exist
    if(emailButton!==null){
      //if there is no consent for email, disable the button 
      if(!emailConsented()){
        emailButton.disabled = true;
        emailButton.value = "No email consent";
      }
      //but if the patient's email is not present in the EMR, disable the button
      else if(patientEmail==null||patientEmail.length<1){
          emailButton.value = "No email on file";
          emailButton.disabled = true;
      }
      //only put patient's email on the button and leave it enabled if email exists and patient has consented
      else{
        emailButton.value = "Email: "+patientEmail;
      }
    }
  }

  for (var i=0;i<textButtons.length;i++){
    var textButton = textButtons[i];
    if(textButton!==null){
      if(!textConsented()){
        textButton.disabled = true;
        textButton.value = "No text consent";
      }
      else if(patientCell==null||patientCell.length<1){
        textButton.value = "No cellphone on file";
        textButton.disabled = true;
      }
      else{
        textButton.value ="Text: "+patientCell;
      }
    }
  }

  for (var i=0;i<consentButtons.length;i++){
    var consentButton = consentButtons[i];
    if(consentButton!==null){
      if(ecnt=="none"){
        consentButton.value = "Do NOT email or text (click to change consent)";
      }
      else if(ecnt==null||ecnt==""){
        consentButton.value = "Get Consent first";
      }
    }
  }
  
  initiated = true;
}

function emailConsented(){
  if(ecnt==null||!ecnt.length>0)
    return false;
  if(ecnt.indexOf("email")>-1||ecnt.indexOf("both")>-1)
    return true;
  else
    return false;
}

function textConsented(){
  if(ecnt==null||!ecnt.length>0)
    return false;
  if(ecnt.indexOf("text")>-1||ecnt.indexOf("both")>-1)
    return true;
  else
    return false;
}

function getECNTMeasurement(){
  var emailConsent;
  var xmlhttp= new XMLHttpRequest();
  var pathArray = window.location.pathname.split( '/' );
  var newURL = window.location.protocol + "//" + window.location.host +"/"+pathArray[1]+"/oscarEncounter/oscarMeasurements/SetupDisplayHistory.do?type=ECNT";
  xmlhttp.onreadystatechange=function(){
    if (xmlhttp.readyState==4 && xmlhttp.status==200){
      var str=xmlhttp.responseText; 
      if (!str) { return; }
      var myRe = /<td width="10">(.*)<\/td>/;  
      var myArray;
      var i=0;
      if((myArray = myRe.exec(str))!== null){
        emailConsent = myArray[1];
      }   
    }
  }
  xmlhttp.open("GET",newURL,false);
  xmlhttp.send();
  ecnt= emailConsent;
  return ecnt;
}

function makeTwilioFriendly(oldString){
  //strip out all non-digit characters
  var newString = oldString.replace(/\D/g,'');

  //need to start with +1 followed by the 10 digit phone number
  if(newString==null||newString.length==0)
    return null;
  if(newString.length==10){
    newString = '+1'+newString;
    return newString;
  }
  else if(newString.length==11&&newString.charAt(0)=='1'){
    newString = '+'+newString;
    return newString;
  }

  return null;
  
}