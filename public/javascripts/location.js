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

                                         $scope.user = {
                                             loggedIn: false,
                                             userId: null,
                                             displayName: "Login"
                                         };

                                         $scope.searchTerm = "";

                                         $scope.searchFor = function(term) {
                                             console.log(term);
                                         };

                                         // $http.get("/user")

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
                                                                      $scope.locationType = $routeParams.locationType;
                                                                      $scope.locationId = $routeParams.locationId;
                                                                      $scope.messages = DEFAULT_MESSAGES;
                                                                      $scope.lastStamp = 0;
                                                                      $http.get(makeUrl($scope.params))
                                                                          .success(
                                                                          function (data) {
                                                                              $scope.messages = cleanMessages(data) || cleanMessages(DEFAULT_MESSAGES);
                                                                              $scope.lastStamp = $scope.messages[$scope.messages.length - 1].msgStamp;
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
             ).when('/user', {
                        templateUrl: "partials/user.html",
                        controller: "userController"
             }).when('/',
                     {
                        templateUrl: "partials/index.html",
                        controller: "indexController"
             }).when('/search/:locationId/:query',
                     {
                         templateUrl: "partials/messages.html",
                         controller: "searchController"
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

    ngLocationSlackedApp.controller('userController', ["$scope", "$routeParams", "$http", "$location", function userController($scope, $routeParams, $http, $location) {

       if ($scope.user && $scope.user.loggedIn === true) {
            console.log("user is logged in");

       } else {
           $location.path('/?action=login');
       }
    }]);

    ngLocationSlackedApp.controller('searchController', ["$scope", "$http", function searchController($scope, $http) {

    }]);

    ngLocationSlackedApp.controller('indexController', ["$scope", "$routeParams", "$http", "$location", function indexController($scope, $routeParams, $http, $location) {

        // user is logged in load user page instead of the login / sign up page
        if ($scope.user && $scope.user.loggedIn === true) {
            console.log("redirecting user to '/user'");
            $location.path('/user');

        } else {

            $scope.allUsers = [{ userId: "abc123", name: "derek rada" }];
            $scope.currentUsers = [];
            $http.get("/user/")
                .success(
                    function (data) {
                        $scope.allUsers = data;
                        $(".chosen-select").chosen({allow_single_deselect: false, disable_search_threshold: 10, width: "50%"});
                    }
            );
        }
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
        if (param.start == 0 || param.start == "0" || param.start == null) {
            return "/" + param.locationType + "/" + param.locationId;
        }
        return "/" + param.locationType + "/" + param.locationId + "?start=" + param.start;
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