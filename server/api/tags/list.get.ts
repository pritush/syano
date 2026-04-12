import { defineEventHandler } from 'h3'
import { listTagsWithCounts } from '~/server/utils/tags'

export default defineEventHandler(async (event) => {
  return {
    items: await listTagsWithCounts(event),
  }
})

