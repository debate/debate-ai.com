import { c as create_ssr_component, a as validate_store, b as subscribe, g as each, v as validate_component, d as add_attribute, e as escape } from './index3-6584cb50.js';
import { c as currentUser, g as getImageURL, p as pb } from './pocketbase-50230876.js';
import 'pocketbase';
import './index2-add8b348.js';

const Tag = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { label } = $$props;
  let { onClick = () => {
  } } = $$props;
  if ($$props.label === void 0 && $$bindings.label && label !== void 0)
    $$bindings.label(label);
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0)
    $$bindings.onClick(onClick);
  return `<button class="text-xs text-neutral-300 bg-emerald-600 rounded-full py-1 text-left px-4 font-semibold hover:cursor-pointer hover:text-white">#${escape(label)}</button>`;
});
const Comment = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { author } = $$props;
  let { authorAvatar } = $$props;
  let { text } = $$props;
  if ($$props.author === void 0 && $$bindings.author && author !== void 0)
    $$bindings.author(author);
  if ($$props.authorAvatar === void 0 && $$bindings.authorAvatar && authorAvatar !== void 0)
    $$bindings.authorAvatar(authorAvatar);
  if ($$props.text === void 0 && $$bindings.text && text !== void 0)
    $$bindings.text(text);
  return `<div class="flex space-x-2 items-center"><img${add_attribute("src", authorAvatar, 0)} alt="Profile Icon" class="w-8 h-8 object-cover rounded-full bg-white">
	<div class="flex flex-col bg-neutral-700 rounded-md p-2"><h5 class="text-sm leading-4 font-semibold">${escape(author)}</h5>
		<h5 class="text-neutral-200">${escape(text)}</h5></div></div>`;
});
const Post = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_currentUser;
  validate_store(currentUser, "currentUser");
  $$unsubscribe_currentUser = subscribe(currentUser, (value) => value);
  let { id } = $$props;
  let { authorId } = $$props;
  let { authorAvatar } = $$props;
  let { content } = $$props;
  let { tags } = $$props;
  let { author } = $$props;
  let { date } = $$props;
  let { likes = [] } = $$props;
  let { comments = [] } = $$props;
  let { onLike } = $$props;
  let { onUnlike } = $$props;
  let { onComment } = $$props;
  let { onDelete } = $$props;
  let commentText;
  let commentInput;
  let tagArr = [];
  if ($$props.id === void 0 && $$bindings.id && id !== void 0)
    $$bindings.id(id);
  if ($$props.authorId === void 0 && $$bindings.authorId && authorId !== void 0)
    $$bindings.authorId(authorId);
  if ($$props.authorAvatar === void 0 && $$bindings.authorAvatar && authorAvatar !== void 0)
    $$bindings.authorAvatar(authorAvatar);
  if ($$props.content === void 0 && $$bindings.content && content !== void 0)
    $$bindings.content(content);
  if ($$props.tags === void 0 && $$bindings.tags && tags !== void 0)
    $$bindings.tags(tags);
  if ($$props.author === void 0 && $$bindings.author && author !== void 0)
    $$bindings.author(author);
  if ($$props.date === void 0 && $$bindings.date && date !== void 0)
    $$bindings.date(date);
  if ($$props.likes === void 0 && $$bindings.likes && likes !== void 0)
    $$bindings.likes(likes);
  if ($$props.comments === void 0 && $$bindings.comments && comments !== void 0)
    $$bindings.comments(comments);
  if ($$props.onLike === void 0 && $$bindings.onLike && onLike !== void 0)
    $$bindings.onLike(onLike);
  if ($$props.onUnlike === void 0 && $$bindings.onUnlike && onUnlike !== void 0)
    $$bindings.onUnlike(onUnlike);
  if ($$props.onComment === void 0 && $$bindings.onComment && onComment !== void 0)
    $$bindings.onComment(onComment);
  if ($$props.onDelete === void 0 && $$bindings.onDelete && onDelete !== void 0)
    $$bindings.onDelete(onDelete);
  $$unsubscribe_currentUser();
  return `<div class="relative">${``}
	<div class="bg-[#333333] 2xl:w-[600px] w-[500px] rounded-md drop-shadow-md text-white p-5"><div class="flex items-center justify-between mb-2"><div class="flex items-center"><img${add_attribute("src", authorAvatar, 0)} alt="Profile Icon" class="h-10 w-10 object-cover mr-3 hover:cursor-pointer rounded-full bg-white">
				<div class="flex flex-col"><button class="font-semibold hover:underline cursor-pointer text-left">${escape(author)}</button>
					<h4 class="text-sm text-neutral-300">${escape(date)}</h4></div></div>
			<div class="flex space-x-2"><button>${`<img src="/heart.svg" alt="Dot Dot Dot" class="w-4 hover:cursor-pointer">`}</button>
				<button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-600"><img src="/dots.svg" alt="Dot Dot Dot" class="w-4 hover:cursor-pointer"></button></div></div>

		<p class="mb-4">${escape(content)}</p>

		<div class="relative text-sm flex text-neutral-300 justify-between mb-4"><p class="hover:underline cursor-pointer">${escape(likes?.length)} likes
			</p>
			<p class="hover:underline cursor-pointer">${escape(comments?.length)} comments</p>
			${``}</div>

		${tagArr.length > 0 ? `<div class="flex space-x-2 mb-4 flex-wrap">${each(tagArr, (tag) => {
    return `${validate_component(Tag, "Tag").$$render($$result, { label: tag }, {}, {})}`;
  })}</div>` : ``}

		<div class="flex justify-around font-semibold text-neutral-300 border-t-[1px] border-b-[1px] border-neutral-600 py-1 mb-4"><button class="flex space-x-2 items-center hover:bg-neutral-600 flex-1 p-1 rounded-md mx-1 justify-center">${`<img src="/heart.svg" alt="Dot Dot Dot" class="w-4 hover:cursor-pointer">
					<p>Like</p>`}</button>
			<button class="flex space-x-2 items-center hover:bg-neutral-600 flex-1 p-1 rounded-md mx-1 justify-center"><img src="/comment.svg" alt="Comment Icon" class="w-4">
				<p>Comment</p></button></div>

		<div class="flex flex-col mb-4 space-y-2">${each(comments, (comment) => {
    return `${validate_component(Comment, "Comment").$$render(
      $$result,
      {
        author: comment.username,
        text: comment.text,
        authorAvatar
      },
      {},
      {}
    )}`;
  })}</div>

		<div><div class="flex space-x-2"><input placeholder="Write a comment" class="w-10/12 bg-[#2D2D2D] rounded-md p-2"${add_attribute("value", commentText, 0)}${add_attribute("this", commentInput, 0)}>
				<button class="bg-[#378E8B] rounded-md w-2/12 font-semibold flex justify-center items-center hover:bg-[#2d7e7b]"><img src="/send.svg" class="h-4" alt="Send Icon"></button></div></div></div></div>`;
});
const UserFollow = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { name } = $$props;
  let { avatar } = $$props;
  let { onClick } = $$props;
  let { onFollow } = $$props;
  if ($$props.name === void 0 && $$bindings.name && name !== void 0)
    $$bindings.name(name);
  if ($$props.avatar === void 0 && $$bindings.avatar && avatar !== void 0)
    $$bindings.avatar(avatar);
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0)
    $$bindings.onClick(onClick);
  if ($$props.onFollow === void 0 && $$bindings.onFollow && onFollow !== void 0)
    $$bindings.onFollow(onFollow);
  return `<div class="flex justify-between mb-2 items-center hover:bg-neutral-700 p-2 rounded-md hover:cursor-pointer"><button class="flex items-center space-x-2"><img${add_attribute("src", avatar, 0)} alt="profile Icon" class="w-8 h-8 object-cover rounded-full bg-white">
    <p>${escape(name)}</p></button>
<button><p class="font-semibold text-[#378E8B] hover:underline hover:cursor-pointer">Follow</p></button></div>`;
});
const BigToggle = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { toggleChanged = () => {
  } } = $$props;
  if ($$props.toggleChanged === void 0 && $$bindings.toggleChanged && toggleChanged !== void 0)
    $$bindings.toggleChanged(toggleChanged);
  return `<div class="bg-[#2E2E2E] 2xl:w-[600px] w-[500px] rounded-md drop-shadow-md text-neutral-300 border-b-[1px] border-neutral-600 flex items-center"><button${add_attribute(
    "class",
    "flex-1 flex justify-center items-center space-x-2 border-b-2 border-[#378E8B] p-5",
    0
  )}>${`<img src="/globe-color.svg" alt="Globe" class="w-5">`}
		<h3${add_attribute(
    "class",
    "font-semibold text-[#378E8B]",
    0
  )}>Global</h3></button>
	<button${add_attribute(
    "class",
    "flex-1 flex justify-center items-center space-x-2 p-3 hover:bg-neutral-700 rounded-md m-2",
    0
  )}>${`<img src="/friends.svg" alt="Group of people" class="w-6">`}
		<h3${add_attribute(
    "class",
    "font-semibold",
    0
  )}>Following</h3></button></div>`;
});
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $currentUser, $$unsubscribe_currentUser;
  validate_store(currentUser, "currentUser");
  $$unsubscribe_currentUser = subscribe(currentUser, (value) => $currentUser = value);
  let postFollowing = false;
  let postTags;
  let userList = [];
  let recommendedList = [];
  let postList = [];
  let postListFollowing = [];
  let followIds = [];
  let followList = [];
  async function likePost(id) {
    if ($currentUser == null)
      return;
    let post = postList.filter((post2) => post2.id == id)[0];
    let likes = [...post.likes, $currentUser.id];
    const data = { likes };
    postList = postList.map((posts) => {
      if (posts.id == post.id)
        posts.likes = likes;
      return posts;
    });
    await pb.collection("posts").update(id, data);
  }
  let canvas;
  async function unlikePost(id) {
    if ($currentUser == null)
      return;
    let post = postList.filter((post2) => post2.id == id)[0];
    let removalIndex = post.likes.indexOf($currentUser.id);
    post.likes.splice(removalIndex, 1);
    let likes = post.likes;
    const data = { likes };
    postList = postList.map((posts) => {
      if (posts.id == post.id)
        posts.likes = likes;
      return posts;
    });
    await pb.collection("posts").update(id, data);
  }
  async function commentPost(id, comment) {
    if ($currentUser == null)
      return;
    let post = postList.filter((post2) => post2.id == id)[0];
    let commentData = {
      post: post.id,
      text: comment,
      author: $currentUser.id,
      username: $currentUser.username
    };
    let newComment = await pb.collection("comments").create(commentData);
    let comments = [...post.comments, newComment.id];
    const updateData = { comments };
    let updatedPost = await pb.collection("posts").update(id, updateData, { expand: "author,comments" });
    postList = postList.map((posts) => {
      if (posts.id == post.id)
        posts = updatedPost;
      return posts;
    });
  }
  async function deletePost(id) {
    postList = postList.filter((post) => post.id !== id);
    await pb.collection("posts").delete(id);
  }
  async function followUser(id) {
    if ($currentUser == null)
      return;
    let user = userList.filter((user2) => user2.id == id)[0];
    if (followIds.includes(user.id))
      return;
    let following = [user.id, ...followIds];
    const data = { following };
    let newUser = await pb.collection("users").update($currentUser.id, data, { expand: "following" });
    followIds = following;
    followList = followIds.length > 0 ? newUser.expand.following : [];
    let followers = [...user.followers, $currentUser.id];
    const receiveData = { followers };
    await pb.collection("users").update(user.id, receiveData);
  }
  $$unsubscribe_currentUser();
  return `


<div class="flex justify-between mt-8 space-x-8 px-8 w-full"><div class="flex-1 max-w-md"><div class="bg-[#2e2e2e] rounded-md drop-shadow-md text-white p-5"><div class="flex justify-between mb-6 items-center"><p class="text-neutral-300">People you may know</p>
				<p class="font-semibold text-sm hover:underline hover:cursor-pointer">See All</p></div>
			${each(recommendedList, (user) => {
    return `${validate_component(UserFollow, "UserFollow").$$render(
      $$result,
      {
        name: user?.username,
        avatar: user?.avatar ? getImageURL(user?.collectionId, user?.id || "", user?.avatar) : "/profile.svg",
        onClick: () => window.location.assign(`http://${window.location.host}/user/${user.id}`),
        onFollow: () => followUser(user.id)
      },
      {},
      {}
    )}`;
  })}</div></div>
	<div class="space-y-6 flex-1 mx-auto items-center flex flex-col">${validate_component(BigToggle, "BigToggle").$$render(
    $$result,
    {
      toggleChanged: (state) => {
        postFollowing = state;
      }
    },
    {},
    {}
  )}
		${each(postFollowing ? postListFollowing : postList, (post) => {
    return `${validate_component(Post, "Post").$$render(
      $$result,
      {
        id: post.id,
        authorId: post.expand?.author?.id,
        authorAvatar: post.expand?.author?.avatar ? getImageURL(post.expand?.author?.collectionId, post.expand?.author?.id || "", post.expand?.author?.avatar) : "/profile.svg",
        author: post.expand?.author?.username,
        date: post?.date,
        content: post?.content,
        tags: post?.tags,
        likes: post?.likes,
        comments: post?.expand?.comments,
        onLike: (id) => likePost(id),
        onUnlike: (id) => unlikePost(id),
        onComment: (id, comment) => commentPost(id, comment),
        onDelete: (id) => deletePost(id)
      },
      {},
      {}
    )}`;
  })}
		${postFollowing && postListFollowing.length < 1 || !postFollowing && postList.length < 1 ? `<p class="text-neutral-500 pt-4">Nothing to see here yet</p>` : ``}</div>
	<div class="flex-1 text-white max-w-md"><div class=""><div class="g_id_signin"${add_attribute("this", canvas, 0)}></div> 
			<div class="flex justify-between items-center mb-4"><h3 class="font-semibold text-neutral-300">Following</h3>
				<img src="/dots.svg" alt="Dot Dot Dot" class="w-4 hover:cursor-pointer"></div>
			${each(followList, (follow) => {
    return `<button class="flex space-x-2 mb-4 hover:bg-neutral-700 p-2 rounded-md hover:cursor-pointer items-center w-full"><img${add_attribute(
      "src",
      follow?.avatar ? getImageURL(follow?.collectionId, follow?.id || "", follow?.avatar) : "/profile.svg",
      0
    )} alt="Dot Dot Dot" class="w-6 bg-white rounded-full">
					<p class="text-sm font-semibold">${escape(follow.username)}</p>
				</button>`;
  })}

			<h3 class="font-semibold text-neutral-300 mb-4">Create Post</h3>
			${`<div class="flex flex-col mb-2"><label for="email" class="text-neutral-400 font-semibold mb-2 text-sm">Content</label>
					<textarea placeholder="" class="bg-[#1b1b1b] p-2 rounded-[4px] mb-4">${escape("")}</textarea>
					<label for="email" class="text-neutral-400 font-semibold mb-2 text-sm">Tags <span class="text-neutral-500">(separate by spaces)</span></label>
					<input placeholder="" type="text" class="bg-[#1b1b1b] p-2 rounded-[4px] mb-4"${add_attribute("value", postTags, 0)}></div>`}
			<button class="bg-[#378E8B] rounded-md p-2 font-semibold flex justify-center items-center w-full hover:bg-[#2d7e7b]">Create Post
			</button></div></div></div>`;
});

export { Page as default };
//# sourceMappingURL=_page.svelte-218eb4a6.js.map
