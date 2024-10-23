import AppServer, { AppRouter, Type } from './appRouter'

const app = new AppServer()
const router = new AppRouter()

const querySchema = Type.Object({
  name: Type.String(),
  age: Type.Optional(Type.Number()),
})

const bodySchema = Type.Object({
  description: Type.String(),
})

router.get('/api/v1/health', async ({ params }) => {
  return { status: 'UP', success: true }
})

router.post(
  '/api/v1/resource',
  async ({ body, query, params }) => {
    // Your logic here
    const resource = {}
    return { success: true, data: { ...body } }
  },
  {
    body: bodySchema,
    query: querySchema,
  }
)

app.router(router).listen(8080, () => {
  console.log('Server is running on port 8080')
})
