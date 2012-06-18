var Ui = {
	init: function() {
		this.load_count = 0;
		this.first_load = true;
		this.last_id = null;
		this.prev_time = null;
		this.refresh();

		this.refresh.periodical(30000, this);

		this.load_cookies();
		this.load_votes();
	},

	load_cookies: function() {
		this.modhash = Cookie.read('reddit_modhash');
	},

	refresh: function() {
		var request_url = 'http://www.reddit.com/comments/' + _thread_id + '.json?sort=new&limit=50'

		new Request.JSONP({
			'url':request_url,
			'callbackKey':'jsonp',
			'onComplete': function(data){
				var post_info = data[0].data.children[0];
				var comments = data[1].data.children.reverse();
				var start_index = this.new_comment(comments, this.last_id);
				var was_bottom = this.is_at_bottom();

				if(this.first_load) {
					$('c-list').empty();
				}

				this.add_comments(comments, start_index);
				this.refresh_comments(comments, start_index);

				if(this.load_count % 5 == 0) {
					// we only want to reload the page destription every so often
					// because we loose the scroll position when this happens...
					this.set_post_info(post_info);
				}

				if(this.first_load) {
					this.set_page_info(post_info);
					this.set_votes();
					this.first_load = false;
				}

				this.last_id = comments.getLast().data.id;

				if(was_bottom) {
					window.scrollTo(0, document.body.scrollHeight);
				}

				this.load_count++;

			}.bind(this)
		}).send();
	},

	set_votes: function() {
		this.upvoted.each(function(comment_id) {
			$('c-'+comment_id).getElement('.uv-link').addClass('has-voted');
		});

		this.downvoted.each(function(comment_id) {
			$('c-'+comment_id).getElement('.dv-link').addClass('has-voted');
		});
	},

	is_at_bottom: function() {
		var totalHeight, currentScroll, visibleHeight;

		if (document.documentElement.scrollTop) {
			currentScroll = document.documentElement.scrollTop;
		} else {
			currentScroll = document.body.scrollTop;
		}

		totalHeight = document.body.offsetHeight;
		visibleHeight = document.documentElement.clientHeight;

		return totalHeight <= (currentScroll + visibleHeight);
	},

	// returns the array index of the first new comment.
	//
	// if none are new it will return comments.length.
	// if all a new it will return 0
	new_comment: function(comments, last_id) {
		var start_index = 0;

		// loop through the list of comments to find the most recent one from last time.
		// Everything after that is new. If we don't find the id, then everything is new
		for(var i=0; i < comments.length; i++) {
			if(comments[i].data.id == this.last_id) {
				start_index = i + 1;
				break;
			}
		}

		return start_index;
	},

	set_post_info: function(post_info) {
		if(post_info.data.selftext_html != null) {
			$('post-info').innerHTML = post_info.data.selftext_html.decodeEntities();
		}
	},

	set_page_info: function(post_info) {

		$e('a', {
			'text':post_info.data.title,
			'href':post_info.data.url
		}).inject('post-title');

		document.title = post_info.data.title + ' - reddit-stream';
	},

	add_comments: function(comments, start_index, insert_into, is_root) {


		comments = comments || [];
		insert_into = insert_into || 'c-list';
		if(!$defined(is_root)) {
			is_root = true;
		}

		for(var i=start_index; i < comments.length; i++) {
			var item = comments[i];
			if(!$defined(item.data.body)) {
				continue;
			}



			var c = new CommentElement(
				insert_into,
				item.data, {
					'first_load': this.first_load,
					'is_root': is_root
				}
			);

			if(is_root && item.data.replies != '') {
				this.add_comments(item.data.replies.data.children, 0, 'c-rpl-' + item.data.id, false)
			}
		}
	},

	// every time we refresh the data the vote counts etc for already
	// displayed comments needs to be updated. The main reason to do this
	// is to display a highlighted link if there are new replies
	refresh_comments: function(comments, end_index) {
		for(var i=0; i < end_index && i < comments.length; i++) {
			var comment = comments[i];
			var elem = $('c-' + comment.data.id);

			if(elem == null || comment == null || comment.kind != 't1') {
				continue;
			}

			var karma = comment.data.ups - comment.data.downs;
			elem.getElement('.c-points').innerHTML = '(' + this.format_points(karma) + ')';

			if(comment.data.replies != null && comment.data.replies != '') {

				// if we  have new replies, then update the count on the page
				var cur_reply_count = elem.getElement('.c-replies').getChildren().length;
				var new_reply_count = comment.data.replies.data.children.length;

				if(cur_reply_count != new_reply_count) {
					var refresh_link = elem.getElement('.r-link');
					refresh_link.innerHTML = 'load replies (' + new_reply_count + ')';
					refresh_link.addClass('has-replies');
				}

				// be sure to update all the replies as well
				this.refresh_comments(comment.data.replies.data.children, new_reply_count);
			}
		}
	},

	format_points: function(count) {
		if(count == 1) {
			return count + ' point';
		} else {
			return count + ' points';
		}
	},

	all_info: function() {
		$('sidebar').addClass('expanded');
	},

	refresh_replies: function(parent_id) {
		var replies_elem = $('c-rpl-' + parent_id);
		var refresh_link = $('c-' + parent_id).getElement('.r-link');
		var request_url = 'http://www.reddit.com/comments/' + _thread_id + '/_/' + parent_id + '.json?limit=50'

		replies_elem.empty();
		$e('div.loading', 'loading...').inject(replies_elem);

		refresh_link.innerHTML = 'refresh';
		refresh_link.removeClass('has-replies');

		new Request.JSONP({
			'url':request_url,
			'callbackKey':'jsonp',
			'onComplete': function(data){
				replies_elem.empty();
				var comment = data[1].data.children[0];

				if(comment.data.replies != '') {
					var replies = comment.data.replies.data.children;
					this.add_comments(replies, 0, replies_elem, false);
				}
			}.bind(this)
		}).send();
	},

	login: function(username, password) {
		var req = new ProxiedRequest({
			'url': 'http://www.reddit.com/api/login/' + username,
			'onSuccess': function(response) {
				if(response.json.errors.length != 0) {
					$('ld-error').innerHTML = response.json.errors[0][1];
				} else {
					this.modhash = response.json.data.modhash;
					Cookie.write('reddit_session', response.json.data.cookie, {duration: 14});
					Cookie.write('reddit_modhash', response.json.data.modhash, {duration: 14});

					$('login-dialog').hide();
				}

				$('ld-submit').disabled = false;
				$('ld-submit').value = 'login';
			}.bind(this)
		}).post({
			'user': username,
			'passwd': password,
			'api_type': 'json'
		});
	},

	vote: function(id, name, direction) {

		if(this.modhash == null) {
			// user is not logged in. Can't vote until that happens, so
			// show the login dialog
			this.show_login();
			return;
		}

		var comment_element = $('c-' + id);
		var upvote_link = comment_element.getElement('.uv-link');
		var downvote_link = comment_element.getElement('.dv-link');
		var change = direction; // how much will the total vote count change?

		if(direction == 1 && this.upvoted.indexOf(id) != -1) {
			direction = 0;
			change = -1;
		} else if(direction == -1 && this.downvoted.indexOf(id) != -1) {
			direction = 0;
			change = 1;
		}

		if(direction == 1) {
			this.upvoted.push(id);
			this.downvoted.erase(id);
			upvote_link.addClass('has-voted');
			downvote_link.removeClass('has-voted');
		} else if(direction == -1) {
			this.upvoted.erase(id);
			this.downvoted.push(id);
			upvote_link.removeClass('has-voted');
			downvote_link.addClass('has-voted');
		} else {
			this.downvoted.erase(id);
			this.upvoted.erase(id);
			upvote_link.removeClass('has-voted');
			downvote_link.removeClass('has-voted');
		}

		this.update_vote_count(comment_element, change);

		var req = new ProxiedRequest({
			'url': 'http://www.reddit.com/api/vote',
			'onSuccess': function(response) {
				if(JSON.encode(response) != JSON.encode({})) {
					alert('Error: Could not save vote');
				} else {
					this.save_votes();
				}
			}.bind(this)
		}).post({
			'id': name,
			'dir': direction,
			'uh': this.modhash
		});
	},

	save_votes: function() {
		if(this.upvoted != null && this.downvoted != null) {
			Cookie.write(_thread_id+'-uv', JSON.encode(this.upvoted), {duration: 14});
			Cookie.write(_thread_id+'-dv', JSON.encode(this.downvoted), {duration: 14});
		}
	},

	load_votes: function() {
		this.upvoted = JSON.decode(Cookie.read(_thread_id+'-uv') || '[]');
		this.downvoted = JSON.decode(Cookie.read(_thread_id+'-dv') || '[]');
	},

	update_vote_count: function(comment_element, change) {
		comment_element = $(comment_element);
		var e = comment_element.getElement('.c-points');
		var points = e.innerHTML.replace('(', '').toInt();
		e.innerHTML = '(' + this.format_points(points + change) + ')';
	},

	show_login: function() {
		$('ld-username').value = '';
		$('ld-password').value = '';
		$('ld-error').value = '';

		$('ld-submit').value = 'login';
		$('ld-submit').disabled = false;

		$('login-dialog').show();
		$('ld-username').focus();
	},

	start_login: function() {
		var username = $('ld-username').value.trim();
		var password = $('ld-password').value.trim();

		if(username != '' && password != '') {
			$('ld-submit').disabled = true;
			$('ld-submit').value = 'loading...';
			this.login(username, password);
		}
	}
}

var CommentElement = new Class({
	initialize: function(container, data, options) {
		this.container = $(container);
		this.data = data;
		this.options = options || {};
		this.options.template = this.options.template || 'tmpl-comment';
		this.options.is_root = $defined(this.options.is_root)? this.options.is_root : true;

		if(!$defined(container) || !$defined(data)) {
			throw 'Must define a container element and pass in data';
		}

		this.normalizeData();
		this.createElement().inject(this.container);
	},

	createElement: function() {

		var jst = new JsTemplate(this.options.template);
		var e = jst.render(this.data);

		if(!this.options.first_load) {
			// not the first element? then fade it in
			e.style.opacity = '0';
			e.fade();
		}

		return e;
	},

	normalizeData: function() {

		this.data.raw_html = this.data.body_html.decodeEntities();
		this.data.created_utc_date = new Date(this.data.created_utc * 1000);
		this.data.formatted_time = this.data.created_utc_date.format('%X');
		this.data.time_hidden = 'hidden';
		this.data.points = Ui.format_points(this.data.ups - this.data.downs);
		this.data.see_replies_link = 'refresh';

		this.data.upvoted = this.data.likes === true? 'has-voted' : '';
		this.data.downvoted = this.data.likes === false? 'has-voted' : '';

		if(this.prev_time != this.data.formatted_time) {
			this.data.time_hidden = '';
			this.prev_time = this.data.formatted_time;
		}

		if(!this.options.is_root && this.data.replies != '' && this.data.replies != null) {
			// we have replies, but are not going to load them because we are already too deep
			// so just flag the refresh link and move on
			this.data.hasreplies = 'has-replies';
			this.data.see_replies_link = 'load replies (' + this.data.replies.data.children.length + ')';
		}
	}

});

var ProxiedRequest = new Class({
	Extends: Request.JSON,

	initialize: function(options) {
		options = options || {};
		options.url = '/redditstream/shared/ba-simple-proxy.php?send_cookies=1&mode=native&url=' + escape(options.url);

		this.parent(options);
	}
});

