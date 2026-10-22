document
.getElementById("signupForm")
.addEventListener("submit", async function(e) {

    e.preventDefault();


    // =========================
    // Get values
    // =========================

    const fname =
        document.getElementById("fname").value.trim();

    const lname =
        document.getElementById("lname").value.trim();

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value.trim();

    const cpassword =
        document.getElementById("cpassword").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const contact =
        document.getElementById("contact").value.trim();


    // =========================
    // Clear errors
    // =========================

    document.getElementById("fname_error").innerText = "";

    document.getElementById("lname_error").innerText = "";

    document.getElementById("username_error").innerText = "";

    document.getElementById("password_error").innerText = "";

    document.getElementById("cpassword_error").innerText = "";

    document.getElementById("email_error").innerText = "";

    document.getElementById("contact_error").innerText = "";


    const message =
        document.getElementById("message");

    message.style.display = "none";


    let valid = true;


    // =========================
    // Validation
    // =========================

    if (fname === "") {

        document.getElementById("fname_error").innerText =
            "First name is required";

        valid = false;
    }


    if (lname === "") {

        document.getElementById("lname_error").innerText =
            "Last name is required";

        valid = false;
    }


    if (username === "") {

        document.getElementById("username_error").innerText =
            "Username is required";

        valid = false;
    }


    if (password === "") {

        document.getElementById("password_error").innerText =
            "Password is required";

        valid = false;
    }


    if (cpassword === "") {

        document.getElementById("cpassword_error").innerText =
            "Confirm password is required";

        valid = false;

    }
    else if (password !== cpassword) {

        document.getElementById("cpassword_error").innerText =
            "Passwords do not match";

        valid = false;
    }


    if (email === "") {

        document.getElementById("email_error").innerText =
            "Email is required";

        valid = false;
    }


    if (!/^\d{10}$/.test(contact)) {

        document.getElementById("contact_error").innerText =
            "Contact must be exactly 10 digits";

        valid = false;
    }


    if (!valid) {

        return;
    }


    // =========================
    // Send data to FastAPI
    // =========================

    try {

        const response = await fetch(
            "http://127.0.0.1:8000/signup",
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    fname: fname,
                    lname: lname,
                    username: username,
                    password: password,
                    email: email,
                    contact: contact

                })

            }
        );


        const result =
            await response.json();


        // =========================
        // FastAPI response
        // =========================

        if (result.success) {

            message.className =
                "alert alert-success";

            message.innerText =
                result.message;

            message.style.display =
                "block";


            document
                .getElementById("signupForm")
                .reset();

        }

        else {

            message.className =
                "alert alert-danger";

            message.innerText =
                result.message;

            message.style.display =
                "block";

        }


    }

    catch (error) {

        console.log(error);


        message.className =
            "alert alert-danger";

        message.innerText =
            "FastAPI server is not running";

        message.style.display =
            "block";

    }

});