var Ui = {
	init: function() {
		this.first_load = true;
		this.last_id = null;
		this.prev_time = null;
		this.refresh();

		this.refresh.periodical(10000, this);
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
					this.set_post_info(post_info);
					this.first_load = false;
				}

				this.add_comments(comments, start_index);
				this.refresh_comments(comments, start_index);

				this.last_id = comments.getLast().data.id;

				if(was_bottom) {
					window.scrollTo(0, document.body.scrollHeight);
				}

			}.bind(this)
		}).send();
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
		$('post-info').innerHTML = post_info.data.selftext_html.decodeEntities();

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

			item.data.raw_html = item.data.body_html.decodeEntities();
			item.data.created_utc_date = new Date(item.data.created_utc * 1000);
			item.data.formatted_time = item.data.created_utc_date.format('%X');
			item.data.time_hidden = 'hidden';
			item.data.points = this.format_points(item.data.ups - item.data.downs);
			item.data.see_replies_link = 'refresh';

			if(this.prev_time != item.data.formatted_time) {
				item.data.time_hidden = '';
				this.prev_time = item.data.formatted_time;
			}

			if(!is_root && item.data.replies != '' && item.data.replies != null) {
				// we have replies, but are not going to load them because we are already too deep
				// so just flag the refresh link and move on
				item.data.hasreplies = 'has-replies';
				item.data.see_replies_link = 'load replies (' + item.data.replies.data.children.length + ')';
			}

			new JsTemplate('tmpl-comment').render(item.data).inject(insert_into);

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
	}
}