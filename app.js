// This loads the environment variables from the .env file
require('dotenv-extended').load();
var builder = require('botbuilder');
var restify = require('restify');
var Store = require('./store');
var spellService = require('./spell-service');
var prompts = require('./prompts');
var http = require('http');
var userMail = "";
const nodemailer = require('nodemailer');
const xoauth2 = require('xoauth2');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('%s listening to %s', server.name, server.url);
});
// Create connector and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector, function (session) {
    session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
});



// You can provide your own model by specifing the 'LUIS_MODEL_URL' environment variable
// This Url can be obtained by uploading or creating your model from the LUIS portal: https://www.luis.ai/
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);
var dialog = new builder.IntentDialog({ recognizer: [recognizer] });
bot.dialog('Grretings', [
    function (session) {
        if (session.userData.userName && session.userData.email && session.userData.mobile) {
            //session.send("Hello " +session.userData.userName);
            session.beginDialog('ServiceOption');
            //session.beginDialog('UserProfile');
        }
        else if (session.userData.userName && !session.userData.email) {
            session.send("Hello " + session.userData.userName);
            session.beginDialog('Email');
        }
        else if (session.userData.userName && session.userData.email && !session.userData.mobile) {
            session.send("Hello " + session.userData.userName);
            session.beginDialog('Mobile');
        }
        else {
            builder.Prompts.text(session, "Welcome to the Car Service Center finder! May I know your name?");
        }

    },
    function (session, results) {
        session.userData.userName = results.response;
        session.beginDialog('Email');
    }

]).triggerAction({
    matches: 'Grretings'
});
bot.dialog('Email', [
    function (session, results) {
        builder.Prompts.text(session, "Kindly provide your email for communication");
    },
    function (session, results) {
        session.userData.email = results.response;
        ValidateEmail(session);
        //builder.Prompts.text(session,"Kindly provide your mobile number for communication");
    }
]);
bot.dialog('InvalidEmail', [
    function (session, results) {
        builder.Prompts.text(session, "Invalid Email,Kindly provide valid email");
    },
    function (session, results) {
        session.userData.email = results.response;
        ValidateEmail(session);
    }
]);
bot.dialog('InvalidMobileNum', [
    function (session, results) {
        builder.Prompts.text(session, "Invalid number,Kindly provide valid 10 digit number");
    },
    function (session, results) {
        session.userData.mobile = results.response;
        ValidateMobileNum(session);
    }
]);

bot.dialog('Mobile', [
    function (session, results) {
        if (!session.userData.mobile)
            builder.Prompts.text(session, "Kindly provide your 10 digit number for communication");
        else session.beginDialog('ServiceOption');
    },
    function (session, results) {
        session.userData.mobile = results.response;
        ValidateMobileNum(session);
    }
]);
bot.dialog('ServiceOption', [
    function (session, results) {
        var servicesOption = ['Car service', 'Car wash'];
        builder.Prompts.choice(session, "Hi " + session.userData.userName + ", please select one of the service options below", servicesOption, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.userData.serviceType = results.response.entity;
        session.beginDialog("SearchCarServiceCenter");
    }
]);
bot.dialog('UserProfile', [
    function (session, args, next) {
        if (!session.userData.userName) {
            var nameEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Name');
            session.userData.userName = nameEntity ? nameEntity.entity : "";
            session.beginDialog('Email');
        }
        else {
            var email = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.email');
            session.userData.email = email.entity;
            ValidateEmail(session);
        }

    }
]).triggerAction({
    matches: 'UserProfile'
});

bot.dialog('Goodbye', [
    function (session) {
        builder.Prompts.text(session, "Bye. Looking forward to our next awesome conversation already.");
        session.userData = null;
    }
]).triggerAction({
    matches: 'Goodbye'
});
bot.dialog('Booking', [
    function (session, results) {
        GetAvailableDates(session);
    }
]).triggerAction({
    matches: 'Booking'
});
bot.dialog('SearchCarServiceCenter', [
    function (session, args, next) {
        if (session.userData.userName && session.userData.email && session.userData.mobile) {
            session.send('Welcome to the Car Service Center finder! We are analyzing your message: \'%s\'', session.message.text);
            //builder.Prompts.text(session, 'Please enter your destination');
            // try extracting entities
            var cityEntity = args && args.intent && args.intent.entities.length ? builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.geography.city') : null;
            var airportEntity = args && args.intent && args.intent.entities.length ? builder.EntityRecognizer.findEntity(args.intent.entities, 'AirportCode') : null;
            if (cityEntity) {
                // city entity detected, continue to next step
                session.dialogData.searchType = 'city';
                next({ response: cityEntity.entity });
            } else if (airportEntity) {
                // airport entity detected, continue to next step
                session.dialogData.searchType = 'airport';
                next({ response: airportEntity.entity });
            } else {
                //no entities detected, ask user for a destination
                builder.Prompts.text(session, 'Please enter your destination');
            }
        }
        else {
            if (!session.userData.userName) {
                session.send("Kindly provide your details first");
                session.beginDialog("Grretings");
            }
            else if (session.userData.userName && !session.userData.email) {
                session.send(session.userData.userName + ", Kindly provide your few details before preceding");
                session.beginDialog("Email");
            }
            else if (session.userData.userName && session.userData.email && session.userData.mobile) {
                session.send(session.userData.userName + ", Kindly provide your few details before preceding");
                session.beginDialog("Mobile");
            }
        }
    },
    function (session, results) {
        var destination = results.response;
        var message = 'Looking for Car Service Center....';
        // if (session.dialogData.searchType === 'airport') {
        //     message += ' near %s airport...';
        // } else {
        message += ' near  %s...';
        //}

        session.send(message, destination);

        // Async search
        Store
            .searchHotels(destination)
            .then(function (hotels) {
                // args
                session.send('I found %d Car Service Center:', hotels.length);

                var message = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(hotels.map(hotelAsAttachment));
                builder.Prompts.choice(session, message, "select:100|select:101|select:102");
                //session.send(message);

                // End
                //session.endDialog();
            });
    },
    function (session, results) {
        session.userData.ServiceCentre = results.response.entity;
        session.beginDialog("Booking");
    }
]).triggerAction({
    matches: 'SearchCarServiceCenter'
    // onInterrupted: function (session) {
    //     session.send('Please provide a destination');
    //}
});
bot.dialog('GetDates', [
    function (session, result) {
        builder.Prompts.choice(session, "Please select the any available date ", session.userData.availableDates, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.userData.selectedDate = results.response.entity;
        GetAvailableSlots(session);
    }
]);

bot.dialog('GetSlots', [
    function (session, result) {
        builder.Prompts.choice(session, "Please select the any available slot ", session.userData.availableSlots, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.userData.selectedSlot = results.response.entity;
        BookSlot(session);
    }
]);
bot.dialog('BookingConfirmed', [
    function (session, results) {
        userMail = session.userData.email;
        var message = new builder.Message(session)
            .addAttachment(BookingConfirmedAsAttachemnt(session));
        session.send(message);
        session.send('Sending confirmation email to  '+session.userData.email);
        SendEmail(session);
    },

]);
bot.dialog('Confirmation', [
    function (session, results) {
        builder.Prompts.choice(session, session.userData.userName + ", would you like to continue?", "Yes|No", { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        if (results.response.entity == 'No') {
            session.userData = null;
            session.endDialog("Ending Conversation, Happy to help");
            session.endConversation("");
        }
        if (results.response.entity == 'Yes') {
            session.send(session.userData.userName + ", how can we help you?")
        }
    }
]);
bot.dialog('ShowCarServiceCentersReviews', function (session, args) {
    // retrieve hotel name from matched entities
    var hotelEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Car');
    if (hotelEntity) {
        session.send('Looking for reviews of \'%s\'...', hotelEntity.entity);
        Store.searchHotelReviews(hotelEntity.entity)
            .then(function (reviews) {
                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(reviews.map(reviewAsAttachment));
                session.endDialog(message);
            });
    }
}).triggerAction({
    matches: 'ShowCarServiceCentersReviews'
});

bot.dialog('Help', function (session) {
    session.endDialog('Hi! Try asking me things like \'search car service\', \'search wash\' or \'show me the reviews of The Bot Resort\'');
}).triggerAction({
    matches: 'Help'
});

// Spell Check
if (process.env.IS_SPELL_CORRECTION_ENABLED === 'true') {
    bot.use({
        botbuilder: function (session, next) {
            spellService
                .getCorrectedText(session.message.text)
                .then(function (text) {
                    session.message.text = text;
                    next();
                })
                .catch(function (error) {
                    console.error(error);
                    next();
                });
        }
    });
}

// Helpers
function hotelAsAttachment(hotel) {
    return new builder.HeroCard()
        .title(hotel.name)
        .subtitle('%d stars. %d reviews. min charges $%d.', hotel.rating, hotel.numberOfReviews, hotel.priceStarting)
        .images([new builder.CardImage().url(hotel.image)])
        .buttons([
            new builder.CardAction()
                .title('Show in Map')
                .type('openUrl')
                .value('http://maps.google.com/?q=' + encodeURIComponent(hotel.location)),
            new builder.CardAction()
                .title('Book a slot')
                .type('imBack')
                .value('Book a slot for ' + hotel.name)

        ]);
}

function reviewAsAttachment(review) {
    return new builder.ThumbnailCard()
        .title(review.title)
        .text(review.text)
        .images([new builder.CardImage().url(review.image)]);
}

function BookingConfirmedAsAttachemnt(session) {
    return new builder.HeroCard()
        .title(session.userData.userName + " your booking for " + session.userData.serviceType + " on " + session.userData.selectedDate + " at " + session.userData.selectedSlot + " has been confirmed.")
        .subtitle("Your communication details")
        .text("Email- " + session.userData.email + " Mobile Number- " + session.userData.mobile)
        .images([new builder.CardImage().url("~/image.png")]);
}


function SendEmail(session) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'hughesmail53@gmail.com',
            pass: 'Bhanu@05',
            xoauth2: xoauth2.createXOAuth2Generator({
                user: 'hughesmail53@gmail.com',
                clientId: '930280742263-93q1mjdoq2m02r3timeg8iajj6223imf.apps.googleusercontent.com',
                clientSecret: 'b7BXcr2oKpbGY154bHkPwsSH',
                refreshToken: '1/oBialtTpd09pFkkxnwTUgjAvviSz0WNYxdvZ5ifY4t8',
                accessToken: 'ya29.GltVBBdxXr_AFmi9qnpKO54tzp1hyLIinKlzQsZZ0Sr1MU7QXvAc37I0l0UHXYJl8mnyVUXyYWebJ_Ixl5HVFmkJuenG7ns1GVaSj9oZawmNW7INiNX-OrMG6AVh'
            })
        }
    });
    var mailOptions = {
        from: 'hughesmail53@gmail.com',
        to: session.userData.email,
        subject: 'Booking for ' + session.userData.serviceType + ' confirmed',
        //text: 'text'
        html: '<p>Hi '+ session.userData.userName+',</p></br><p>Your booking for '+ session.userData.serviceType+' on ' + session.userData.selectedDate+' at ' +  session.userData.selectedSlot+' has been confirmed.</p><p>Happy to help</p></br></br><h3>Regards</h3><h3>Hughes</h3>'
    }
    transporter.sendMail(mailOptions, function (err, res) {
        if (err) {
            session.send('Oops, something went wrong in sending email, will be sent later');
            console.log(err);
            session.beginDialog('Confirmation');
        }
        else {
            session.send('Booking confirmed, confirmation email sent to ' + session.userData.email);
            session.beginDialog('Confirmation');
        }

    })
    
}

/**
 * 
 *API call function starts
 */

function GetAvailableDates(session) {
    http.get("http://webapilearning20170517094105.azurewebsites.net/api/Employee/GetAvailableDates", function (res) {
        res.on('data', function (data) {
            session.userData.availableDates = JSON.parse(data);
            session.beginDialog("GetDates");
        });
    })
};

function GetAvailableSlots(session) {
    var url = "http://webapilearning20170517094105.azurewebsites.net/api/Employee/GetAvailableSlots/" + session.userData.selectedDate;
    http.get(url, function (res) {
        res.on('data', function (data) {
            session.userData.availableSlots = JSON.parse(data);
            if (session.userData.availableSlots.length == 0) {
                session.send("Currently no slot avialable,Kindly selected some other date");
                session.beginDialog("GetDates");
            }
            else {
                session.beginDialog("GetSlots");
            }

        });
    })
};
function BookSlot(session) {
    var hour = String(session.userData.selectedSlot).substring(0, 2);
    var min = String(session.userData.selectedSlot).substring(3, 5);
    var url = "http://webapilearning20170517094105.azurewebsites.net/api/Employee/BookAppoitment/" + session.userData.selectedDate + "/" + hour + "/" + min + "/" + session.userData.userName + "/" + session.userData.email + "/" + session.userData.mobile;
    http.get(url, function (res) {
        res.on('data', function (data) {
            //session.userData.availableSlots = JSON.parse(data);
            session.beginDialog("BookingConfirmed");
        });
    })
};
/**
 * 
 *API call function End
 */

/**
 * 
 *Validate function starts
 */
function ValidateEmail(session) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (re.test(session.userData.email)) {
        session.beginDialog("Mobile");
    }
    else {
        session.beginDialog("InvalidEmail");
    }
}

function ValidateMobileNum(session) {
    var re = /^\d{10}$/;
    if (re.test(session.userData.mobile)) {
        session.beginDialog("ServiceOption");
    }
    else {
        session.beginDialog("InvalidMobileNum");
    }
}
/**
 * 
 *API call function Ends
 */