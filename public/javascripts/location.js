/**
 * Created by Derek Rada on 12/11/2014.
 */

(function(angular) {


    var DEFAULT_MESSAGES = [{msgStamp: null, name: "Slacked", msg: "No messages"}];
    var ERROR_MESSAGE = [{msgStamp: null, name: "Error", msg: "Error loading data"}];
    var DEFAULT_CHANNELS = [];
    var DEFAULT_GROUPS = [];

    var ngLocationSlackedApp = angular.module('ngLocationSlackedApp', ["ngRoute"]);

    angular.element(document.getElementsByTagName('head')).append(angular.element('<base href="' + window.location.pathname + '" />'));

    ngLocationSlackedApp
        .controller("ngMainController",
                                    ["$scope",
                                     "$route",
                                     "$routeParams",
                                     "$location",
                                     function ($scope, $route, $routeParams, $location, $http) {
                                         $scope.$route = $route;
                                         $scope.$location = $location;
                                         $scope.$routeParams = $routeParams;
                                     }
                                    ]
    );

    ngLocationSlackedApp.controller('ngSidebarController',
                                    ["$scope",
                                     "$http",
                                     function ngSidebarController($scope, $http) {

                                         $scope.channels = DEFAULT_CHANNELS;
                                         $scope.groups = DEFAULT_GROUPS;
                                         $scope.loadChannel = function (isChannel, id) { // for testing
                                             if (isChannel == true) {
                                                 console.log("Channel");
                                             }
                                             console.log(id);
                                         };

                                         // Download channels
                                         $http.get('/channel')
                                             .success(
                                             function (data) {
                                                 $scope.channels = data;

                                             }
                                         ).error(
                                             function (data, status) {
                                                 console.log("Couldn't retrieve channels. status: " + status);
                                                 console.log(data);
                                             }
                                         );
                                         // Download groups
                                         $http.get('/group')
                                             .success(
                                             function (data) {
                                                 $scope.groups = data;
                                             }
                                         )
                                             .error(
                                             function (data, status) {

                                                 console.log("Couldn't retrieve groups. status: " + status);
                                                 console.log(data);
                                             }
                                         );


                                     }
                                    ]
    );

    /**
     * Controller for HistoryController (messages)
     */
    ngLocationSlackedApp.controller('locationHistoryController', ["$scope", "$routeParams", "$http",
                                                                  function locationHistoryController($scope,
                                                                                                     $routeParams,
                                                                                                     $http) {

                                                                      console.log("Inside LocationHistoryController");
                                                                      console.log($routeParams);
                                                                      $scope.params = $routeParams;

                                                                      $scope.messages = DEFAULT_MESSAGES;
                                                                      $http.get(makeUrl($scope.params))
                                                                          .success(
                                                                          function (data) {
                                                                              $scope.messages = cleanMessages(data) || cleanMessages(DEFAULT_MESSAGES);
                                                                          }
                                                                      ).error(
                                                                          function (data) {
                                                                              console.log(data || "No data");
                                                                              $scope.messages = cleanMessages(ERROR_MESSAGE);
                                                                          }
                                                                      );
                                                                  }
    ]
    );

    /***
     * Configure routeProvider for angular app
     */
    ngLocationSlackedApp.config(
        ['$routeProvider',
         function ($routeProvider) {
             $routeProvider.
                 when('/history/:locationType/:locationId', {
                          templateUrl: "partials/messages.html",
                          controller:  "locationHistoryController"
                      }
             ).when('/login', {
                        templateUrl: "partials/login.html",
                        controller: "loginController"
             }).when('/',
                     {
                        templateUrl: "partials/index.html",
                        controller: "indexController"
             }).otherwise({ redirectTo: "/" });
         }
        ]
    );


    /***
     * Not used yet
     */
    ngLocationSlackedApp.controller('ngMessageViewer', ["$scope", "$http", function ngMessageViewer($scope, $http) {

        $scope.messages = [{ts: tsToDateString(), name: "Slacked", msg: "No messages"}];

        /*
         $scope.$on("updateMessages", function (event, args) {

         });
         */
    }]);


    /***
     * cleanMessages - Adds msg.date and msg.time to the data for $scope.messages helps make it look nice
     * @param data = [{ }] (messages)
     * @returns {Array}
     */
    function cleanMessages(data) {

        if (data && data.length && data.length > 0) {

            for (var i = 0; i < data.length; i++) {
                var tmp = tsToDateString(data[i].msgStamp);
                data[i].date = tmp.date;
                data[i].time = tmp.time;

            }
            console.log(data);
            return data;
        } else {
            return cleanMessages(DEFAULT_MESSAGES);
        }
    }

    /***
     * Turns route parameters into the request url
     * @param param { locationType: "channel | group", locationId: "CXXXXXXX | GXXXXXXX" }
     * @returns {string}
     */
    function makeUrl(param) {
        // :locationType/:locationId
        if (!param.locationType) {
            param.locationType = "channel";
        }
        return "/" + param.locationType + "/" + param.locationId;
    }


    /***
     * tsToDateString
     * @param id [number]
     * @returns {Object} = { date: {String}, time: {Time} }
     */
    function tsToDateString(id) {

        var tmp = new Date();
        if (id && typeof id == "number") {
            tmp = new Date(id);
        }
        return {date: tmp.toLocaleDateString(), time: tmp.toLocaleTimeString()};
    }

})(window.angular);