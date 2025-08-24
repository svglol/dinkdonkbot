export class JsonResponse extends Response {
  constructor(body: object, init = {}) {
    const jsonBody = JSON.stringify(body)

    const mergedInit = {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
      ...init,
    }

    super(jsonBody, mergedInit)
  }
}
