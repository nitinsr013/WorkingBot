// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var restify = require('restify');
var Store = require('./store');
var spellService = require('./spell-service');
var prompts = require('./prompts');
var http = require('http');
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
var dialog = new builder.IntentDialog({recognizer:[recognizer]});


bot.dialog('Grretings', [
    function (session) {
        builder.Prompts.text(session, "Welcome to the Car Service Center finder! May I know your name?");
    },    
    function (session,results) {
        session.userData.userName = results.response;
       var servicesOption = ['Search car wash', 'Search car service'];
        builder.Prompts.choice(session, "Hi " + results.response + ", please select one of the service options below", servicesOption, { listStyle: builder.ListStyle.button });
    }, 
    function(session,results){
        session.userData.serviceType = results.response.entity;
        session.beginDialog("SearchCarServiceCenter");
    }
]).triggerAction({
    matches: 'Grretings'
});

bot.dialog('UserProfile', [
   

   function (session, args, next) {
        var nameEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Name');   
        session.userData.userName =  nameEntity.entity;
       var servicesOption = ['Search car wash', 'Search car service'];
        builder.Prompts.choice(session, "Hi " +  nameEntity.entity + ", please select one of the service options below", servicesOption, { listStyle: builder.ListStyle.button });
    }, 
    function(session,results){
        session.userData.serviceType = results.response.entity;
        session.beginDialog("SearchCarServiceCenter");
    }
]).triggerAction({
    matches: 'UserProfile'
});

bot.dialog('Goodbye', [
function (session) {
builder.Prompts.text(session, "Bye. Looking forward to our next awesome conversation already.");
} 
]).triggerAction({
matches: 'Goodbye'
}); 
bot.dialog('Booking',[
    function(session,results){
    GetAvailableDates(session);
    }
]);
bot.dialog('SearchCarServiceCenter', [
    function (session, args, next) {
        session.send('Welcome to the Car Service Center finder! We are analyzing your message: \'%s\'', session.message.text);
        builder.Prompts.text(session, 'Please enter your destination');
        // try extracting entities
        // var cityEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.geography.city');
        // var airportEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'AirportCode');
        // if (cityEntity) {
        //     // city entity detected, continue to next step
        //     session.dialogData.searchType = 'city';
        //     next({ response: cityEntity.entity });
        // } else if (airportEntity) {
        //     // airport entity detected, continue to next step
        //     session.dialogData.searchType = 'airport';
        //     next({ response: airportEntity.entity });
        // } else {
            // no entities detected, ask user for a destination
            //builder.Prompts.text(session, 'Please enter your destination');
       // }
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
    function(session,results){ 
        session.userData.ServiceCentre = results.response.entity;
        session.beginDialog("Booking");
        
    //builder.Prompts.choice(session, "Please select the any avialble slot ", session.userData.availableDates, { listStyle: builder.ListStyle.button }); 
    }
// function(session,results){ 
//         builder.Prompts.text(session, session.userData.userName + " booking for " +results.response.entity + " slot is completed. Happy to help you");
//         session.endDialog();
//     }
]).triggerAction({
    matches: 'SearchCarServiceCenter',
    onInterrupted: function (session) {
        session.send('Please provide a destination');
    }
});
bot.dialog('GetDates',[
    function(session, result){
builder.Prompts.choice(session, "Please select the any available date ", session.userData.availableDates, { listStyle: builder.ListStyle.button });
},
function(session,results){ 
    session.userData.selectedDate = results.response.entity;
    GetAvailableSlots(session);  
    }
]);

bot.dialog('GetSlots',[
    function(session, result){
        builder.Prompts.choice(session, "Please select the any available slot ", session.userData.availableSlots, { listStyle: builder.ListStyle.button });
},
function(session,results){
    session.userData.selectedSlot = results.response.entity;
    BookSlot(session);
}
]);
bot.dialog('BookingConfirmed',[
 function(session,results){
     builder.Prompts.text(session,"Booking Done");
     session.endDialog("Happy to help");
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
    session.endDialog('Hi! Try asking me things like \'search hotels in Seattle\', \'search hotels near LAX airport\' or \'show me the reviews of The Bot Resort\'');
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
                .value('Book a slot for '+hotel.name)
              
        ]);
}

function reviewAsAttachment(review) {
    return new builder.ThumbnailCard()
        .title(review.title)
        .text(review.text)
        .images([new builder.CardImage().url(review.image)]);
}

function GetAvailableDates(session) {
    http.get("http://192.168.1.84:8087/api/Employee/GetAvailableDates", function (res) {
        res.on('data', function (data) {
            session.userData.availableDates = JSON.parse(data);
            session.beginDialog("GetDates");
        });
    })
};

function GetAvailableSlots(session) {
    var url = "http://192.168.1.84:8087/api/Employee/GetAvailableSlots/"+session.userData.selectedDate;
    http.get(url, function (res) {
        res.on('data', function (data) {
            session.userData.availableSlots = JSON.parse(data);
            if(session.userData.availableSlots.length == 0){
                session.send("Currently no slot avialable,Kindly selected some other date");
                session.beginDialog("GetDates");
            }
            else{
                session.beginDialog("GetSlots");
            }
            
        });
    })
};
function BookSlot(session) {
    var hour = String(session.userData.selectedSlot).substring(0,2);
    var min = String(session.userData.selectedSlot).substring(3,5);
    var url = "http://192.168.1.84:8087/api/Employee/BookAppoitment/"+session.userData.selectedDate+"/"+hour+"/"+ min+ "/"+session.userData.userName;
    http.get(url, function (res) {
        res.on('data', function (data) {
            //session.userData.availableSlots = JSON.parse(data);
            session.beginDialog("BookingConfirmed");
        });
    })
};