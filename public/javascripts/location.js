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
        .controller(
        "ngMainController",
        [
            "$scope",
            "$route",
            "$routeParams",
            "$location",
            "$http",
            "$rootScope",
            function ($scope, $route, $routeParams, $location, $http, $rootScope) {
                $scope.$route = $route;
                $scope.$location = $location;
                $scope.$routeParams = $routeParams;

                var user = {
                    loggedIn:    false,
                    userId:      window.localStorage.getItem("slacked:user_selected"),
                    displayName: "Login"
                };

                $scope.globes = {
                    _users:    [],
                    _channels: [],
                    _groups:   [],
                    _profile:  user
                };

                $rootScope.$on("authenticated", function (event, args) {
                    console.log("RootScope authenticated");

                    $rootScope.$broadcast("updateSideBar");
                               }
                );

                $http.get("/user/auth")
                    .success(
                    function (data) {
                        if (data && data.success) {
                            console.log("Success /user/auth");
                            console.log(data);
                            $scope.globes._profile.loggedIn = data.loggedIn;
                            $scope.globes._profile.userId = data.userId;
                            $scope.globes._profile.displayName = data.displayName;

                            $scope.$emit("authenticated");
                            console.log($scope.globes._profile);
                            $location.path("/user");
                        } else {
                            console.log("Error /user/auth");
                            console.log(data);
                        }
                    }
                );


            }
        ]
    );

    ngLocationSlackedApp.controller(
        'ngSidebarController',
        [
            "$scope",
            "$http",
            "$rootScope",
            function ngSidebarController($scope, $http, $rootScope) {

                $scope.channels = DEFAULT_CHANNELS;
                $scope.groups = DEFAULT_GROUPS;

                function refresh() {

                    console.log("Refreshing sidebar");
                    // Download channels
                    $http.get('/channel')
                        .success(
                        function (data) {
                            $scope.channels = data;
                            $scope.globes._channels = data;
                        }
                    );
                    // Download groups
                    $http.get('/group')
                        .success(
                        function (data) {
                            $scope.groups = data;
                            $scope.globes._groups = data;
                        }
                    );
                }

                $scope.refresh = refresh;
                refresh();

                $scope.$on("updateSideBar", function () {
                    console.log("Recieved updateSideBar from root");
                    $scope.refresh();
                }
                );

            }
        ]
    );

    /**
     * Controller for HistoryController (messages)
     */
    ngLocationSlackedApp.controller(
        'locationHistoryController',
        [
            "$scope",
            "$routeParams",
            "$http",

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

        console.log("UserController");
        if ($scope.globes._profile && $scope.globes._profile.loggedIn === true) {

            $scope.searchData = {
                term:                 "",
                startDate:            new Date().getTime() - 3600000, // 1 hour
                endDate:              new Date().getTime(),
                locations:            [],
                selectedLocationName: "Location",
                selectedLocationId:   null
            };

            $('#startDate').datetimepicker(
                {
                    onChangeDateTime: function (time) {
                        $scope.searchData.startDate = time.getTime();
                        console.log("Start Date: " + $scope.searchData.startDate);
                    }
                }
            );
            $('#endDate').datetimepicker(
                {
                    onChangeDateTime: function (time) {
                        $scope.searchData.startDate = time.getTime();
                        console.log("Start Date: " + $scope.searchData.endDate);
                    }
                }
            );

            $scope.searchFor = function (term) {
                console.log(term);
            };
            $scope.setLocation = function (location) {
                $scope.searchData.selectedLocationName = location.name;
                $scope.searchData.selectedLocationId = location.locationId;
            }


        } else {
            $location.path('/');
       }
    }]);

    ngLocationSlackedApp.controller('searchController', ["$scope", "$http", function searchController($scope, $http) {

    }]);

    ngLocationSlackedApp.controller('indexController', ["$scope", "$routeParams", "$http", "$location", function indexController($scope, $routeParams, $http, $location) {

        // user is logged in load user page instead of the login / sign up page
        if ($scope.globes._profile && $scope.globes._profile.loggedIn === true) {
            console.log("redirecting user to '/user'");
            $location.path('/user');

        } else {

            // used as temporary storage to authenticate and control flow
            $scope.authData = {
                token: "",
                step2: false,
                timedWait: false,
                selectedUser: $scope.globes._profile.userId
            };

            var lastSelected = window.localStorage.getItem("slacked:user_selected");

            if (lastSelected) {
                $scope.authData.selectedUser = lastSelected;
            }

            // Setup chosen input box
            $("#userDropDown").chosen({allow_single_deselect: false, disable_search_threshold: 5, width: "275px", placeholder_text_single: "Select user"});

            $("#userDropDown").on("change", function () {
                setTimeout(function() {
                    $scope.$apply();
                    window.localStorage.setItem("slacked:user_selected", $scope.authData.selectedUser);
                }, 250);
            });

            $scope.startAuthProcess = function() {
                $scope.globes._profile.userId = $scope.authData.selectedUser;
                console.log("Starting auth process");

                $http.get('/user/auth?userId=' + $scope.globes._profile.userId).
                    success(
                    function (data) {
                        if (data && data.success === true) {
                            $scope.authData.step2 = true;
                            $scope.authData.timedWait = true;

                            setTimeout(function () {
                                $scope.authData.timedWait = false;
                                $scope.$apply();
                            }, 60000);
                        } else {
                            console.log("Bad request");
                            // TODO notify user
                        }
                    }
                ).error(
                    function (data) {
                        console.log("Error request");
                        // TODO notify user
                    }
                )
            };

            $scope.finishAuthProcess = function(token) {
                var token = token || $scope.authData.token;
                if (token && token.length > 0) {

                    $http.post("/user/auth/" + $scope.globes._profile.userId, {token: token})
                        .success(
                            function (data) {
                                if (data && data.success == true) {

                                    $scope.token = "";
                                    $scope.globes._profile.userId = data.userId;
                                    $scope.globes._profile.loggedIn = true;
                                    $scope.globes._profile.displayName = data.displayName;
                                    console.log("I logged in here!!");
                                    $scope.$emit("authenticated");
                                    $location.path("/user/");
                                }
                            }
                    );
                }
                console.log(token);
            };

            // get users
            $scope.allUsers = [];

            $http.get("/user/")
                .success(
                function (data) {

                    $scope.allUsers = data;
                    $scope.globes._users = data;
                    setTimeout(function () {

                        $("#userDropDown").trigger("chosen:updated");
                    }, 250);
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