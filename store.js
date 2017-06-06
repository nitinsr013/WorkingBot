var Promise = require('bluebird');

var ReviewsOptions = [
    '“Very stylish, great stay, great staff”',
    '“good car service center awful machines”',
    '“Need more attention to little things”',
    '“Lovely small car service center ideally situated to explore the area.”',
    '“Positive surprise”',
    '“Beautiful suite and resort”'];
var address = [
    "Himgiri Hyundai Service Center, Gurugram, Haryana",
    "Hyundai Service Center, Near IOC Petrol Pump, Sector 52A, Wazirabad, Gurugram, Haryana",
    "Skoda Service Centre, Gurugram, Haryana",
    "Maruti Car Service Center - MeriCAR.com, Gurugram, Haryana",
    "Big Swing Honda, Gurugram, Haryana"
];
module.exports = {
    searchHotels: function (destination) {
        return new Promise(function (resolve) {

            // Filling the hotels results manually just for demo purposes
            var hotels = [];
            for (var i = 1; i <= 5; i++) {
                hotels.push({
                    name: destination + ' Car Service center ' + i,
                    location: address[i-1],
                    rating: Math.ceil(Math.random() * 5),
                    numberOfReviews: Math.floor(Math.random() * 5000) + 1,
                    priceStarting: Math.floor(Math.random() * 450) + 80,
                    image: 'http://realtimedashbord20170501102742.azurewebsites.net/Content/CarService'+i+'.png '
                });
            }

            hotels.sort(function (a, b) { return a.priceStarting - b.priceStarting; });

            // complete promise with a timer to simulate async response
            setTimeout(function () { resolve(hotels); }, 1000);
        });
    },

    searchHotelReviews: function (hotelName) {
        return new Promise(function (resolve) {

            // Filling the review results manually just for demo purposes
            var reviews = [];
            for (var i = 0; i < 5; i++) {
                reviews.push({
                    title: ReviewsOptions[Math.floor(Math.random() * ReviewsOptions.length)],
                    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris odio magna, sodales vel ligula sit amet, vulputate vehicula velit. Nulla quis consectetur neque, sed commodo metus.',
                    image: 'https://upload.wikimedia.org/wikipedia/en/e/ee/Unknown-person.gif'
                });
            }

            // complete promise with a timer to simulate async response
            setTimeout(function () { resolve(reviews); }, 1000);
        });
    }
};