import { getCollection, type CollectionEntry } from 'astro:content'

export type Post = CollectionEntry<'posts'>

export const POSTS_PER_PAGE = 6

/** 已发布文章：置顶优先，其余按发布日期倒序 */
export async function getSortedPosts(): Promise<Post[]> {
    const posts = await getCollection('posts', ({ data }) => !data.draft)
    return posts.sort((a, b) => {
        if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1
        return b.data.pubDate.getTime() - a.data.pubDate.getTime()
    })
}

/** 在排好序的列表里取当前文章的上/下篇（prev = 更新一篇，next = 更旧一篇） */
export function getAdjacentPosts(sorted: Post[], current: Post) {
    const index = sorted.findIndex((p) => p.id === current.id)
    return {
        prev: index > 0 ? sorted[index - 1] : undefined,
        next:
            index >= 0 && index < sorted.length - 1
                ? sorted[index + 1]
                : undefined,
    }
}
