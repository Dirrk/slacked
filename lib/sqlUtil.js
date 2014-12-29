/**
 * Created by Derek Rada on 12/3/2014.
 */


var mysql = require('mysql');
var util = require('util');
var async = require('async');
// var slackUtil = require('./slackUtil');

var default_config = { database: "slacked", connectionLimit: 10, host: "192.168.1.35", user: "slacked", password: "slacked123!" /* dev test settings here */ };
var sqlConfig;

var pool = null;
var connections = {
    active: 0,
    opened: 0,
    closed: 0,
    errors: 0,
    queries: 0
};

exports.start = function start(config, cb) {

    sqlConfig = config;
    exports.testSQL(cb);

    var interval = 14400000; // 4 Hours
    if (global.appConfig.debug) {
        interval = 3600000; // Hourly
    }
    setInterval(SQLStatus, interval);

};
exports.testSQL = function testSQL(cb) {

    // Test SQL Working
    openSQLConnection(function (conn) {
       if (conn) {
           console.log("Connection tested successfully");
           conn.release();
           if (cb) { cb(null); }

       } else {
           if (cb) { cb(new Error("Testing SQL Failed")); }
       }
    });

    // var test_data = [{"dateTimeStamp":1418135355000,"location":"C02UQ5ULT","user":null,"text":"<@U024TE6S5|gary.nakanelua> has left the channel"},{"dateTimeStamp":1418119735000,"location":"C02UQ5ULT","user":"U02J8HH00","text":"HttpStatusCode [500], uri: /aime/Fronts.svc/fronts/site/{siteId}, - at Gannett.Modules.Utilities.CoreClient.CoreClientBase.HandleErrors(IRestRequest request, IRestResponse response, Boolean rethrow) in l:\\Workspace\\Workflow-MultiSite\\DNN\\DesktopModules\\UDMW\\Utilities\\CoreClient\\CoreClientBase.cs:line 146 at Gannett.Modules.Utilities.CoreClient.CoreClientBase.Execute(IRestRequest request) in l:\\Workspace\\Workflow-MultiSite\\DNN\\DesktopModules\\UDMW\\Utilities\\CoreClient\\CoreClientBase.cs:line 44 at RestSharp.RestClient.Execute[T](IRestRequest request) at Gannett.Modules.Utilities.CoreClient.CoreClientBase.Execute[T](RestRequest request) in l:\\Workspace\\Workflow-MultiSite\\DNN\\DesktopModules\\UDMW\\Utilities\\CoreClient\\CoreClientBase.cs:line 53 at Gannett.Modules.Utilities.CoreClient.FrontsServiceAgent.GetFrontsBySite(Int64 siteId, Boolean seriesOnly, Boolean sort, String status) in l:\\Workspace\\Workflow-MultiSite\\DNN\\DesktopModules\\UDMW\\Utilities\\CoreClient\\FrontsServiceAgent.cs:line 188 at Gannett.Modules.Utilities.CoreClient.FrontsServiceAgent.GetFrontsBySite(Int64 siteId, Boolean seriesOnly, String status) in l:\\Workspace\\Workflow-MultiSite\\DNN\\DesktopModules\\UDMW\\Utilities\\CoreClient\\FrontsServiceAgent.cs:line 175 at Gannett.Modules.Utilities.CoreClient.FrontsServiceAgent.GetFronts(Int64 siteId, String searchTerm, Boolean inActiveOnly) in l:\\Workspace\\Workflow-MultiSite\\DNN\\DesktopModules\\UDMW\\Utilities\\CoreClient\\FrontsServiceAgent.cs:line 45 at DotNetNuke.Modules.ManageFronts.View.rtlFronts_NeedDataSource(Object sender, TreeListNeedDataSourceEventArgs e)"},{"dateTimeStamp":1418074659000,"location":"C02UQ5ULT","user":"U02J8HH00","text":"3AM RP/RB: <https://confluence.gannett.com/display/GDPREL/5.9.5.0+Production+GDP+Release>"},{"dateTimeStamp":1418073351000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"i'll take care of it now"},{"dateTimeStamp":1418073347000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"oh shit, sorry got sidetracked with work"},{"dateTimeStamp":1418072239000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"finish"},{"dateTimeStamp":1418072235000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"seth can we finsh"},{"dateTimeStamp":1418070090000,"location":"C02UQ5ULT","user":"U02MT4ZR1","text":"Hey Guys, GDPREL-4317\t\nPush updates for <http://marcoislandflorida.com|marcoislandflorida.com> mappings is what I was mentioning."},{"dateTimeStamp":1418069963000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"thanks seth"},{"dateTimeStamp":1418069747000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"Environment has achieved normality. Anything you still can't cope with is therefore your own problem."},{"dateTimeStamp":1418069676000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"enabling second half"},{"dateTimeStamp":1418069673000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"confirmed phx is good"},{"dateTimeStamp":1418069662000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"looks good"},{"dateTimeStamp":1418069654000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"confirmed moc is good"},{"dateTimeStamp":1418069628000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"ok"},{"dateTimeStamp":1418069541000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"bcast finishing up on the second half"},{"dateTimeStamp":1418069371000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"uscp finishing up on the second half"},{"dateTimeStamp":1418068975000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"ok"},{"dateTimeStamp":1418068896000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"i concur, enabling first half and disabling second"},{"dateTimeStamp":1418068745000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"both looks good on first half"},{"dateTimeStamp":1418068708000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"and checking broadcast now"},{"dateTimeStamp":1418068703000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"uscp looks good"},{"dateTimeStamp":1418068695000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"you can check that too"},{"dateTimeStamp":1418068555000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"bcast is finishing up for 1st half"},{"dateTimeStamp":1418068533000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"for ip in {{42..91},{129..158}}; do echo -n \"$ip - \" ; curl -s -H \"Host: <http://ux.app.com|ux.app.com>\" <http://10.186.50>.$ip/ | grep -i window.site_static_path; done"},{"dateTimeStamp":1418068510000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"for ip in {{42..91},{129..158}}; do echo -n \"$ip - \" ; curl -s -H \"Host: <http://ux.app.com|ux.app.com>\" <http://10.189.50>.$ip/ | grep -i window.site_static_path; done"},{"dateTimeStamp":1418068458000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"you can check first half uscp"},{"dateTimeStamp":1418068455000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"uscp"},{"dateTimeStamp":1418068454000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"bcastmob"},{"dateTimeStamp":1418068453000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"can i check"},{"dateTimeStamp":1418068450000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"bcast installing for first half"},{"dateTimeStamp":1418068444000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"ok"},{"dateTimeStamp":1418068415000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"for uscp-web"},{"dateTimeStamp":1418068408000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"first half finishing up now"},{"dateTimeStamp":1418068055000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"ok"},{"dateTimeStamp":1418068035000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"toggling down first set"},{"dateTimeStamp":1418067913000,"location":"C02UQ5ULT","user":"U02QL89JR","text":":raised_hands:"},{"dateTimeStamp":1418067829000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"updating SF now"},{"dateTimeStamp":1418067809000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"okey dokey"},{"dateTimeStamp":1418066631000,"location":"C02UQ5ULT","user":"U02QL89JR","text":":information_desk_person:"},{"dateTimeStamp":1418066344000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"can we please start the prod"},{"dateTimeStamp":1418066338000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"Broadcast-mobile 1.4"},{"dateTimeStamp":1418066321000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"uscp-web 45.1.1"},{"dateTimeStamp":1418066170000,"location":"C02UQ5ULT","user":"U02QL89JR","text":"HI"},{"dateTimeStamp":1417813613000,"location":"C02UQ5ULT","user":"U02J8HH00","text":"Sri has you covered"},{"dateTimeStamp":1417813605000,"location":"C02UQ5ULT","user":"U02J8HH00","text":"if I am... I won't be managing any releases, ha"},{"dateTimeStamp":1417813591000,"location":"C02UQ5ULT","user":"U02J8HH00","text":"pffffyt"},{"dateTimeStamp":1417813185000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"Nico"},{"dateTimeStamp":1417812960000,"location":"C02UQ5ULT","user":"U02HA1ZM3","text":"You gonna be up?"},{"dateTimeStamp":1417812553000,"location":"C02UQ5ULT","user":"U02J8HH00","text":"3 AM Runbook/Release Plan: <https://gannett.jira.com/wiki/display/GDPREL/5.9.3.1+Production+GDP+Release>"}];
    // console.log(convertHistoryDataToArray(test_data));
};

exports.getConnection = function(cb) {
    openSQLConnection(cb);
};

// open sql
/***
 * Opens connection to SQL and calls back with (connection)
 * @param callback connection or null
 */
function openSQLConnection(callback) {

    if (!pool) { // if no pool create pool
        if (sqlConfig) {
        } else if (global.appConfig) {
            sqlConfig = global.appConfig.sql || default_config;
        } else {
            sqlConfig = default_config;
        }
        pool = mysql.createPool(sqlConfig);

        pool.on('connection', function (statusConn) {

            connections.opened = connections.opened + 1;
            connections.active = connections.active + 1;

            statusConn.on('end', function (err) {
                if (err) {
                    connections.errors = connections.errors + 1;
                }
                connections.closed = connections.closed + 1;
                connections.active = connections.active - 1;
            });

        });
        pool.getConnection(sqlPoolHandler);
    } else {
        pool.getConnection(sqlPoolHandler);
    }
    function sqlPoolHandler(err, connection) {
        if (err) {
            if (err.fatal) {
                pool.end(function () {
                    pool = mysql.createPool(sqlConfig);
                });
            } else {
                console.error(err);
            }
            callback(null);
        } else {
            connections.queries = connections.queries + 1;
            callback(connection);
        }
    }

}

function SQLStatus() {

    if (pool) {
        console.log("SQL STATUS :: %j", connections);
    }
}



/*

/**
 *    addHistoryToSQL(data)
 *    @param {array} data - The data to insert ex: [{"dateTimeStamp":1417559852000,"location":"C033NTT94","user":"U02HA1ZM3","text":"boom"},{"dateTimeStamp":1417559844000,"location":"C033NTT94","user":null,"text":"<@U02HA1ZM3|sethdozier> has joined the channel"}]
 *    @param {function} callback - Function to call back to using standard js error first callback
 *
 *    @return callback(err, success)
 *    Convert data from JSON data to Array of Arrays in the order locationId, userId, msgStamp, msg
 *    Execute query
 *    If successful callback(null, true)
 *    else callback(null, false)
 **
exports.addHistoryToSQL = function addHistoryToSQL(data, callback) {

    var newHistoryQuery = "INSERT INTO slacked.channel_history (locationId, userId, msgStamp, msg) VALUES ?";

    if (data && util.isArray(data)) {
        // convertdata
        var arr = convertHistoryDataToArray(data);

        // open sql connection
        openSQLConnection(function (conn) {

           if (conn) { // execute query
               var query = conn.query(newHistoryQuery, [arr], function (err) {
                   conn.release();

                   if (err) {
                       console.log(query.sql);
                       console.log("Found error on connection query");
                       callback(err, false);
                   } else {
                       callback(null, true);
                   }
               });
           } else {
               // no connection
               console.log("No Connection to sql found");
               callback(null, false);
           }
        });
    } else {
        callback(null, false);
    }
};


exports.updateIndex = function updateIndex(locationId, lastIndex) {

    var updateIndexQueryString = "UPDATE locations SET lastIndex = ? WHERE locationId = ?";

    var locationId = locationId,
        lastIndex = lastIndex || null;

    if (lastIndex == null) {
        console.log("No index provided, will not update index for " + locationId);
        return;
    }

    try {

        openSQLConnection(function (conn) {

            if (conn) {

                var query = conn.query(updateIndexQueryString, [lastIndex, locationId], function (err, results) {
                    conn.release();
                   if (err) {
                       console.log(query.sql);
                       console.log("Failed updated index in SQL");
                       console.error(err);
                   } else {
                       if (global.appConfig.debug) {
                           console.log("Updated index for location: " + locationId + " to " + lastIndex);
                           console.log(results);
                       }
                   }
                });
            } else {
                console.log("Couldn't connect to db to update last index of " + locationId);
            }
        });

    } catch (e) {

        console.log("Error updating index");
        console.error(e);
    }

};

exports.subscribeToLocation = function subscribeToLocation(override, locations, callback) {

    var sqlQuery = "INSERT INTO locations (locationId, name, isChannel, subscribed) VALUES ? ON DUPLICATE KEY UPDATE ";
    if (override) {
        sqlQuery = sqlQuery + "subscribed = values(subscribed)";
    } else {
        sqlQuery = sqlQuery + "locationId = values(locationId)";
    }

    if (!(locations.length >= 1)) {
        console.log("Locations is either not an array or is empty");
        callback(null);
    } else {

        openSQLConnection(function (conn) {
           if (conn) {

               var query = conn.query(sqlQuery, [locations], function (err, data) {

                   if (err) {
                       console.log("Failed to subscribe to locations");
                       console.log(query.sql);
                       console.error(err);
                       callback(err);
                   } else {

                       if (global.appConfig.debug) {
                           console.log(data);
                       }
                       callback(null);
                   }
                   conn.release();
               });
           } else {
               console.log("SubscribeToLocation :: Could not obtain a sql connection");
               callback(null);
           }
        });
    }
};

exports.getSubscribedChannels = function getSubscribedChannels(callback) {

    openSQLConnection(function (conn) {
       if (conn) {

           var sqlQuery = "SELECT locationId, lastIndex, name FROM locations WHERE subscribed=1 AND isChannel=1";
           var query = conn.query(sqlQuery, function (err, data) {
               conn.release();
               if (err) {
                   console.log(query.sql);
                   callback(err, []);
               } else {
                   if (global.appConfig.debug) {
                       console.log("Downloaded data for subscribed channels");
                       console.log(data);
                   }
                   callback(err, data);
               }
           });

       } else {
           callback(null, []);
       }
    });

};


exports.addUsersToDB = function addUsersToDB(users, callback) {

    var userArray = convertUserDataToArray(users);
    openSQLConnection(function (conn) {

        if (conn) {

            var sqlQuery = "INSERT INTO user (userId, name) VALUES ? ON DUPLICATE KEY UPDATE name = values(name)";

            var query = conn.query(sqlQuery, [userArray], function (err, results) {
                conn.release();
                callback(err);
                if (global.appConfig.debug) {
                    console.log(query.sql);
                    console.log("Added users to db");
                    console.log(results);
                }
            });

        } else {
            callback(null);
        }

    });
};

exports.getLocationHistory = function getLocationHistory(config, callback) {

    if (!config) { config = {}}
    if (!config.start) {
        config.start = new Date().getTime();
    }
    if (!(config.isChannel === false)) {
        config.isChannel = true;
    }
    if (!config.userId) {
        config.userId == null;
    }
    if (!config.locationId) {
        callback(null, []);
        return;
    }

    if (config.isChannel === true) {
        exports.getChannelHistory(config.start, config.locationId, callback);
    } else {
        slackUtil.verifyUserHasAccess(config.userId, config.locationId, function (access) {
            if (access === true) {
                exports.getChannelHistory(config.start, config.locationId, callback);

            } else {
                callback([])
            }
        });
    }
};
exports.getChannelHistory = function getChannelHistory(start, channelId, callback){

    var SQLHistoryQuery = "SELECT locations.name, user.name, msgStamp, msg FROM slacked.channel_history LEFT JOIN user on channel_history.userId = user.userId LEFT JOIN locations on channel_history.locationId = locations.locationId WHERE channel_history.locationId = ? AND msgStamp < ? ORDER BY msgStamp DESC LIMIT 100";
    openSQLConnection(function (conn) {

        conn.query(SQLHistoryQuery, [channelId, start], function(err, data) {
            conn.release();
            if (err) {
                console.log("error getting history");
                console.error(err);
                callback(null, []);
            } else {

                if (global.appConfig.debug) {

                    console.log("HistoryQuery");
                    console.log(data);
                }
                callback(null, data);
            }
        });
    });

};
exports.getProfileByUserId = function getProfileByUserId(userId, callback) {

    if ( userId ) {

        openSQLConnection(function (conn) {

            if (conn) {

                var sqlQuery = "SELECT slackedId,userId,isZombie,slackToken FROM slacked.profiles WHERE userId = ?";
                var query = conn.query(sqlQuery, userId, function (err, values) {

                    conn.release();

                    if (err) {
                        console.log("Error getting profiles");
                        console.log(query.sql);
                        console.error(err);

                    } else {
                        if (values && values.length > 0) {
                            callback(values[0]);
                        } else {
                            callback(null);
                        }
                    }
                });

            } else {
                callback(null);
            }

        });

    } else {
        callback(null);
    }


};

exports.getProfiles = function getProfiles(zombie, callback) {

    openSQLConnection(function (conn) {

        if (conn) {
            var whereClause = " ";
            if (zombie) { whereClause = " WHERE isZombie=1 "; };
            var sqlQuery = "SELECT slackedId,userId,isZombie,slackToken FROM slacked.profiles" + whereClause + "ORDER by isZombie,slackedId;";
            var query = conn.query(sqlQuery, function (err, values) {

                conn.release();
                if (err) {
                    console.log("Error getting profiles");
                    console.log(query.sql);
                    console.error(err);
                } else {
                    if (zombie && values.length > 0) {
                        callback(values[0]);
                    } else {
                        callback(values);
                    }
                }
            });

        } else {
            callback(null);
        }

    });
};
exports.addProfile = function addProfile(profile, callback) {

  openSQLConnection(function (conn) {

      if (conn) {

          var sqlQuery = "INSERT INTO profiles SET ?";
          var query = conn.query(sqlQuery, profile, function (err, values) {

              if (err) {
                  console.log(query.sql);
                  console.error(err);
                  callback(null);
              } else {
                  if (values.insertId) {
                      callback(values.insertId);
                  } else {
                      callback(null);
                  }
              }
          });
      } else {
          callback(null);
      }
  });
};

exports.subscribeToGroups = function subscribeToGroups(profiles, callback) {

    console.log("SubscribeToGroups");
    console.log(profiles);

    async.eachSeries(profiles,

         function (profile, next) {

             var data = groupsArrayFromProfile(profile);

             if (!data || !data.length || data.length < 1) {
                 next();
             } else {
                 console.log("Data at subscribe");
                 console.log(data);

                 var sqlQuery = "INSERT INTO locations (locationId, subscribed, name, isChannel) VALUES ? ON DUPLICATE KEY UPDATE name = values(name)";

                 openSQLConnection(function (conn) {

                     if (conn) {
                         var query = conn.query(sqlQuery, [data], function (err, results) {
                             conn.release();
                             if (err) {
                                 console.error(err);
                                 next();
                             }
                             console.log(query.sql);
                             console.log(results);

                             next();
                         });

                     } else {
                         next()
                     }
                 });
             }

    }, function () {

            openSQLConnection(function (conn) {
               if (conn) {

                   var sqlQuery = "SELECT locations.locationId, locations.lastIndex, locations.name, locations.isChannel FROM slacked.locations WHERE locations.subscribed=1 AND locations.isChannel=0";
                   var query = conn.query(sqlQuery, function (err, results) {

                       conn.release();
                       if (err) {
                           console.log("Error getting active groups");
                           console.log(query.sql);
                           console.error(err);
                           callback(null);
                       } else {

                           console.log(results);
                           callback(results);
                       }

                   });

               } else {
                   callback(null);
               }

            });
    });

};

/***
 * Updates the location information after retrieving the locations from slack
 * @param {locations} { channels: [], groups: [] }
 * @param callback
 *
exports.updateLocationInformation = function updateLocationInformation(locations, callback) {

    //
    // var sqlQuery = "SELECT locations.locationId, locations.lastIndex, locations.name, locations.isChannel FROM slacked.locations WHERE locations.subscribed=1 AND locations.isChannel=0";
    if (locations && locations.channels && locations.groups) {


        openSQLConnection(function (conn) {

            if (conn) {




            } else {
                callback(new Error("Couldn't connect to sql"));
            }

        });

    } else {
        callback(new Error("Locations was not in correct format"));
    }
};

function groupsArrayFromProfile(profile) {

    var ret = [];
    var userId = profile.userId;
    var isChannel = 0;
    var subscribed = 1;

    for (var i = 0; i < profile.groups.length; i++) {
        // return { locationId: group.id, lastIndex: null, isChannel: false, name: group.name };
        ret.push([profile.groups[i].locationId, subscribed, profile.groups[i].name, isChannel]);
    }

    return ret;
}


/**

 @function convertHistoryDataToArray(data)
 @data - Array from addHistoryToSQL

 Iterate through Array of JSON
 **
function convertHistoryDataToArray(data) {

    var ret = [];

    for (var i = 0; i < data.length; i++) {
        ret.push([ data[i].location, data[i].user, data[i].dateTimeStamp, data[i].text]);
    }
    return ret;
}

function convertUserDataToArray(data) {

    var ret = [];

    for (var i = 0; i < data.length; i++) {
        ret.push([ data[i].userId, data[i].name]);
    }
    return ret;
}


exports.search = function search(startDate, endDate, location, query, callback) {


    var sqlQuery = "SELECT * FROM slacked.channel_history WHERE locationId = ? AND msgStamp >= ? AND msgStamp <= ?";
    var words = query.split(" ");
    var params = [location, startDate, endDate];
    for (var i = 0; i < words.length; i++) {

        words[i] = "%" + words[i] + "%";
        sqlQuery = sqlQuery + ' AND msg like ?';
        params.push(words[i]);
    }
    openSQLConnection(function (conn) {

        var q = conn.query(sqlQuery, params, function (err, data) {
            conn.release();
            console.log(q.sql);
            if (err) {

                console.log(err);
                callback([]);
            } else {
                console.log(data);
                callback(data);
            }
        }
        );

    }
    );
};
*/