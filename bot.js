/* outa[bot] // app.js
   Copyright (c) 2012-2013 outa[dev].
*/

(function() {
	//the twitter api module
	var twitter = require('ntwitter'),
		LogUtils = require('./lib/LogUtils.js'),

		//the username of the bot. not set to begin with, we'll get it when authenticating
		botUsername = null,

		//create an object using the keys we just determined
		twitterAPI = new twitter(require('./apiKeys.json'));
	
	//check if we have the rights to do anything
	twitterAPI.verifyCredentials(function(error, userdata) {
		if (error) {
			//if we don't, we'd better stop here anyway
			LogUtils.logtrace(error, LogUtils.Colors.RED);
			process.exit(1);
		} else {
			//the credentials check returns the username, so we can store it here
			botUsername = userdata.screen_name;
			LogUtils.logtrace("logged in as " + userdata.screen_name, LogUtils.Colors.CYAN);

			//start listening to tweets that contain the bot's username using the streaming api
			initStreaming();
		}
	});

	function streamCallback(stream) {
		LogUtils.logtrace("streaming", LogUtils.Colors.CYAN);

		//when we're receiving something
		stream.on('data', function(data) {
			//if it's actually there
			if(data.text !== undefined) {
				var checkOrder = data.text.match(/(réponds à|reply to|mentionne|mention|parle à|talk to|speak to) @([a-zA-Z0-9]+)/i);

				if(checkOrder != null && checkOrder[2] != null) {
					data.user.screen_name = checkOrder[2];
				}

				if(data.user.screen_name.toLowerCase() != botUsername.toLowerCase() 			//if it wasn't sent by the bot itself
					&& data.text.toLowerCase().indexOf('@' + botUsername.toLowerCase()) != -1 	//if it's really mentionning us (it should)
					&& data.retweeted_status === undefined) {									//and if it isn't a retweet of one of our tweets

					LogUtils.logtrace("[" + data.id_str + "] @mention from " + data.user.screen_name, LogUtils.Colors.GREEN);
					
					//getting a random tweet using the "yes.thatcan.be/my/next/tweet/" method							
					//we pass it the username of the real person, a reference to the twitter api module, and a callback
					require("./lib/MyNextTweet.js").getNewTweet(data, twitterAPI, 
						function(error, newTweetData) {
							if (error) {
								//handling the error, again
								LogUtils.logtrace(error, LogUtils.Colors.RED);
							} else {
								LogUtils.logtrace("[" + newTweetData.reply_id + "] #got random tweet for " + newTweetData.username, LogUtils.Colors.GREEN);
								//store the final tweet (containing the mention)
								var tweetDone = '@' + newTweetData.username + " " + newTweetData.tweet;
								
								//reply to the tweet that mentionned us
								twitterAPI.updateStatus(tweetDone.substring(0, 139), { in_reply_to_status_id: newTweetData.reply_id },
									function(error, statusData) {
										if (error) {
											LogUtils.logtrace(error, LogUtils.Colors.RED);
										} else {
											LogUtils.logtrace("[" + statusData.in_reply_to_status_id_str + "] ->replied to " + statusData.in_reply_to_screen_name, LogUtils.Colors.GREEN);
										}
									}
								);
							}
						}
					);
				}
			}
		});

		stream.on('end', onStreamError);
		stream.on('error', onStreamError);

		setTimeout(stream.destroy, 1000 * 60 * 60);
	}

	function onStreamError(e) {
		//when stream is disconnected, connect again
		LogUtils.logtrace("STREAM END. (" + e + ")", LogUtils.Colors.RED);
		initStreaming();
	}

	function initStreaming() {
		twitterAPI.stream('user', { with:'followings', track:'@' + botUsername }, streamCallback);
	}

})();