document
.getElementById("loginForm")
.addEventListener("submit", async function(e) {

    e.preventDefault();


    // =========================
    // Get values
    // =========================

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value.trim();


    const message =
        document.getElementById("message");


    message.style.display = "none";


    // =========================
    // Validation
    // =========================

    if (username === "" || password === "") {

        message.className =
            "alert alert-danger";

        message.innerText =
            "Please enter username and password";

        message.style.display =
            "block";

        return;
    }


    // =========================
    // Send to FastAPI
    // =========================

    try {

        const response = await fetch(
            "http://127.0.0.1:8000/login",
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    username: username,
                    password: password

                })

            }
        );


        const result =
            await response.json();


        // =========================
        // Login successful
        // =========================

        if (result.success) {

            message.className =
                "alert alert-success";

            message.innerText =
                result.message;

            message.style.display =
                "block";


            // Save username

            localStorage.setItem(
                "username",
                result.username
            );


            // Go to home

            setTimeout(function() {

                window.location.href =
                    "home.html";

            }, 1000);

        }


        // =========================
        // Login failed
        // =========================

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