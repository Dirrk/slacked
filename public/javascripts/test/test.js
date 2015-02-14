/**
 * Created by Derek Rada on 1/11/2015.
 */

(function(ang) {

    function a(angular) {
        "use strict";
        // Setup Angular App
        console.log("Test a - 1");

        var ngLocationSlackedApp = angular.module('ngLocationSlackedApp', ["ngRoute"]);
        angular.element(document.getElementsByTagName('head')).append(angular.element('<base href="' + window.location.pathname + '" />'));
        console.log("Test a - 2");

        /***
         * Configure routeProvider for angular app
         */
        ngLocationSlackedApp.config(
            [
                '$routeProvider',
                function ($routeProvider) {
                    $routeProvider
                        .when(
                            '/search',
                            {
                                templateUrl: "partials/search.html",
                                controller:  "ngSearchController"
                            }
                    )
                        .otherwise(
                        {
                            templateUrl: "partials/test.html",
                            controller: "testController"
                        }

                    )
                    ;
                }
            ]
        );
        console.log("Test a - 3");

    };

    function b(angular) {
        "use strict";
        // Setup Test Angular Controllers
        console.log("Test b - 1");
        var ngApp = angular.module('ngLocationSlackedApp');
        console.log("Test b - 2");

        ngApp.controller(
            'testController',
            [
                "$scope",
                "testService1",
                "testService2",
                "locationService",
                "$rootScope",
                "$http",
                "$location",
                "$routeParams",
                testController
            ]
        );

        function testController($scope, service, service2, locationService, root) {
            console.log("Test b - Inside TestController");
            $scope.test = {
                results: [],
                channels: [],
                groups: []
            };
            /*
            service.fn(
                function (val) {
                    console.log("Test b - Service-FN");
                    $scope.test.results.push(val);
                    $scope.$apply();
                }
            );
            */
            root.$watch(
               service2.count,
                function () {
                    console.log("Found changed data");
                    if (service2.data.length > 0) {
                        // $scope.test.results.push(service2.data[service2.data.length - 1]);
                    }
            });
            root.$watch(
                locationService.watcher,
                function () {
                    if (locationService.watcher() > 0 && locationService.watcher() %2 === 0) {
                        console.log("Found new location data");
                        $scope.test.channels = locationService.getChannels();
                        $scope.test.groups = locationService.getGroups();
                        $scope.test.results.push("Channels: " + JSON.stringify(locationService.getChannels()));
                        $scope.test.results.push("Groups: " + JSON.stringify(locationService.getGroups()));
                    } else {
                        console.log("initiating watcherService");
                    }
                }
            );
            service2.refreshData();
        }
    };
    function c(angular) {
        "use strict";
        // Setup Angular Services
        console.log("Test c - 1");
        var ngApp = angular.module('ngLocationSlackedApp');
        ngApp.factory(
            'testService1',
            [
                '$http',
                function () {
                    console.log("Test c - 2");
                    return {
                        fn: function (callback) {
                            setTimeout(
                                function () {
                                    console.log("Test c - 3");
                                    callback("fnFactory");
                                },
                                5000
                            );
                        }
                    }
                }
            ]
        );

        ngApp.factory(
            'testService2',
            [
                "$rootScope",
                function testService2($rootScope) {
                    var data = [];
                    var counter = 0;
                    var ret = {
                        count: function () { return counter; } ,
                        data: data,
                        refreshData: function () {
                            console.log("test c2 - 1");
                            setInterval(
                                function () {
                                    if (counter < 5)
                                    {
                                        console.log("test c2 - 2");
                                        data.push("testService2-" + new Date().getTime());
                                        counter++;
                                        console.log(ret.data);
                                        $rootScope.$digest();
                                    }
                                }
                            ,5000);
                        }
                    };
                    return ret;
                }
            ]
        );

        ngApp.factory(
            'locationService',
            [
                "$rootScope",
                "$http",
                function locationService($rootScope, $http) {

                    var channels = [],
                        groups = [],
                        __counter = 0,
                        ret = {
                            getChannels:  function () { return  channels; },
                            getGroups:  function () { return  groups; },
                            watcher: function () {
                                return __counter;
                            },
                            refresh: function (force) {

                                console.log("Refreshing locations");
                                if (force !== true) {
                                    force = false;
                                } else {
                                    force = true;
                                }
                                // Download channels
                                $http.get('/channel?force=' + force)
                                    .success(
                                    function (data) {
                                        if (data && data.success) {
                                            console.log("Channels: ", data.locations);
                                            channels = data.locations.slice(0);
                                            __counter++;
                                        }
                                    }
                                );

                                // Download groups
                                $http.get('/group?force=' + force)
                                    .success(
                                    function (data) {
                                        if (data && data.success) {
                                            console.log("Groups:", data.locations);
                                            groups = data.locations.slice(0);
                                            __counter++;
                                        }
                                    }
                                );
                            }
                        };
                        return ret;
                    }
                ]
        );
    }
    // Final
    function d(angular) {

        "use strict";
        // Setup Angular Controllers
        console.log("Test d - 1");
        var ngApp = angular.module('ngLocationSlackedApp');
        console.log("Test d - 2");

        ngApp
            .controller(
            "ngMainController",
            [
                "$scope",
                "$route",
                "$routeParams",
                "$location",
                "$http",
                "$rootScope",
                "locationService",
                function ($scope, $route, $routeParams, $location, $http, $rootScope, locationService) {

                    $scope.$route = $route;
                    $scope.$location = $location;
                    $scope.$routeParams = $routeParams;
                    $scope.startPage = $location.path();
                    $scope.startTime = new Date().getTime();

                    var user = {
                        loggedIn:    false,
                        userId:      window.localStorage.getItem("slacked:user_selected"),
                        displayName: "Login",
                        channels: [],
                        groups: []
                    };

                    $rootScope.users = {};
                    $rootScope.user = user;
                    $rootScope.channels = [];
                    $rootScope.groups = [];
                    $scope.user = $rootScope.user;

                    $rootScope.$on(

                        "authenticated",
                        function (event, args) {
                           locationService.refresh(false);
                           if (($scope.startTime + 2000 < new Date().getTime())) { // If on refresh the user is authenticated load the page they requested instead
                               $location.path($scope.startPage);
                           }
                        }
                    );

                    $http.get("/user/auth")
                        .success(
                        function (data) {
                            if (data && data.success) {
                                console.log("Success /user/auth");
                                console.log(data);
                                $rootScope.user.loggedIn = data.loggedIn;
                                $rootScope.user.userId = data.userId;
                                $rootScope.user.displayName = data.displayName;

                                $scope.$emit("authenticated");
                                console.log($rootScope.user);
                                $location.path($scope.startPage || "/user");
                            } else {
                                console.log("Error /user/auth");
                                console.log(data);
                            }
                        }
                    );


                }
            ]
        );

        ngApp.controller(
            'ngSidebarController',
            [
                "$scope",
                "$http",
                "$rootScope",
                "locationService",
                function ngSidebarController($scope, $http, $rootScope, locationService) {

                    $scope.channels = [];
                    $scope.groups = [];

                    $rootScope.$watch(
                        locationService.watcher,
                        function (val1) {
                            if (val1 % 2 === 0) {
                                $scope.channels = locationService.getChannels();
                                $scope.groups = locationService.getGroups();
                            }
                        }
                    );
                }
            ]
        );

    };
    function e(angular) {
        "use strict";
        // Setup Angular Controllers
        console.log("Test e - 1");
        var ngApp = angular.module('ngLocationSlackedApp');
        ngApp.controller(
            'ngSearchController',
            [
                "$scope",
                "$http",
                "$rootScope",
                "$location",
                "$routeParams",
                "locationService",
                function ngSearchController(
                    $scope,
                    $http,
                    $rootScope,
                    $location,
                    $routeParams,
                    locationService) {
                    console.log("Test e - 2");

                    // if (!$rootScope.user || $rootScope.user.loggedIn !== true) {
                    // $location.path('/');
                    // }

                    $scope.searchData = {
                        term:                 $routeParams.query || "",
                        startDate:            0,
                        endDate:              4389369600000,
                        locations:            [],
                        selectedLocationName: "Location",
                        selectedLocationId: $routeParams.locationId || null,
                        messages:           [],
                        total: 0,
                        isMore: false,
                        nextDate: 0
                    };
                    $scope.channels = locationService.getChannels();
                    $scope.groups = locationService.getGroups();
                    console.log("Test e - 3");
                    if ($routeParams.startDate) {
                        $scope.searchData.startDate = parseInt($routeParams.startDate);
                    }
                    if ($routeParams.endDate) {
                        $scope.searchData.startDate = parseInt($routeParams.endDate);
                    }

                    console.log("Test e - 4");
                    $('#startDate').datetimepicker(
                        {
                            onChangeDateTime: function (time) {
                                $scope.searchData.startDate = time.getTime();
                            }
                        }
                    );
                    $('#endDate').datetimepicker(
                        {
                            onChangeDateTime: function (time) {
                                $scope.searchData.endDate = time.getTime();
                            }
                        }
                    );

                    $scope.searchFor = function (endDate) {

                        var httpRequest = {

                            url: "/history/" + $scope.searchData.selectedLocationId,
                            method: "GET",
                            params: {
                                start: $scope.searchData.startDate,
                                end: endDate || $scope.searchData.endDate,
                                query: $scope.searchData.term
                            }
                        };
                        console.log("Searching for stuff");
                        console.log(httpRequest);
                        $http(httpRequest).success(
                            function (data) {

                                if (data && data.success) {
                                    $scope.searchData.isMore = data.isMore;
                                    $scope.searchData.nextDate = data.nextDate;
                                    $scope.searchData.total = data.total;
                                    $scope.searchData.messages = cleanMessages(data.data);
                                }
                            }
                        );




                        // var url = "/history/" + $scope.searchData.selectedLocationId;

                        /* $http.post(url, { query: term } )
                         .success(
                         function (data) {
                         if (data && data.success) {
                         $scope.searchData.isMore = data.isMore;
                         $scope.searchData.nextDate = data.nextDate;
                         $scope.searchData.total = data.total;
                         $scope.searchData.messages = cleanMessages(data.data);
                         }
                         }
                         ); */
                    };
                    $scope.setLocation = function (location) {
                        $scope.searchData.selectedLocationName = location.name;
                        $scope.searchData.selectedLocationId = location.locationId;
                    };
                }
            ]
        );
    };

    a(ang);
    d(ang);
    e(ang);
    b(ang);
    c(ang);

})(window.angular);