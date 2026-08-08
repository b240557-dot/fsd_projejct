function studentregistration() {
  console.log('clicked')
    let fname=document.getElementById("fname").value;
    let lname=document.getElementById("lname").value;
    let email=document.getElementById("email").value;
     let contact=document.getElementById("contact").value;

     console.log(fname, "\n", lname)

   if(!fname)
   {
    var fname_errror = document.getElementById("fname_error").innerHTML="Please enter your name";
    
   }
   else if(!lname)
   {
    var lname_errror=document.getElementById("lname_error").innerHTML="Please enter your last name";
    
   }
   else if(!email)
   {
    var email_errror=document.getElementById("email_error").innerHTML="Please enter email";
   }
   
   else if(!contact) 
   {
    var contact_errror=document.getElementById("contact_error").innerHTML="Please enter contact";
   }
   

   else{
    var success_errror=document.getElementById("success_error").innerHTML="your registration is successful";
}
}