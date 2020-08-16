import { fetchUtils } from 'react-admin';
import { stringify } from 'query-string';

const apiUrl = 'https://localhost:8080/v1/';
const httpClient = fetchUtils.fetchJson;

/**
 * Maps react-admin queries to Sandpiper API
 *
 * @example
 *
 * getList     => GET http://my.api.url/users?sort=title:asc&filter=field:value&page=1&pagesize=24&
 * getOne      => GET http://my.api.url/users/123
 * getMany     => GET http://my.api.url/users?filter={id:[123,456,789]}
 * update      => PUT http://my.api.url/users/123
 * create      => POST http://my.api.url/users
 * delete      => DELETE http://my.api.url/users/123
 *
 * @example
 *
 * import * as React from "react";
 * import { Admin, Resource } from 'react-admin';
 * import simpleRestProvider from 'ra-data-simple-rest';
 *
 * import { PostList } from './posts';
 *
 * const App = () => (
 *     <Admin dataProvider={simpleRestProvider('http://path.to.my.api/')}>
 *         <Resource name="posts" list={PostList} />
 *     </Admin>
 * );
 *
 * export default App;
 */

 // The following parseFilters() routine modified from:
 // https://github.com/raphiniert-com/ra-data-postgrest.git
function parseFilters(filter, defaultListOp) {
  let result = {};
  Object.keys(filter).forEach(function (key) {
    // key: the name of the object key
    const operation = defaultListOp;
    let values;
    values = [filter[key]];

    values.forEach(value => {
      let op = `${operation}.${value}`;
      if (result[key] === undefined) {
        // first operator for the key, we add it to the dict
        result[key] = op;
      }
      else
      {
        if (!Array.isArray(result[key])) {
          // second operator, we transform to an array
          result[key] = [result[key], op]
        } else {
          // third and subsequent, we add to array
          result[key].push(op);
        }
      }
    });

  });

  return result;
}

export default {
    getList: (resource, params) => {
        const { page, perPage } = params.pagination;
        const { field, order } = params.sort;
        const parsedFilter = parseFilters(params.filter, 'eq');
        const query = {
            sort: `${field} ${order.toLowerCase()}`,
            offset: (page - 1) * perPage,
            limit: page * perPage - 1,
            filter: parsedFilter,
        };
        const url = `${apiUrl}/${resource}?${stringify(query)}`;
        return httpClient(url).then(({ headers, json }) => {
            paging = json.paging
            return {
                data: json,
                total: parseInt(${paging.items_total}),
            };
        });
    },

    getOne: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`).then(({ json }) => ({
            data: json,
        })
    ),

    // no getMany route, so fallback to calling getOne n times instead
    getMany: (resource, params) => {
        Promise.all(
            params.ids.map(id =>
                httpClient(`${apiUrl}/${resource}/${id}`, {
                    method: 'GET',
                    body: JSON.stringify(params.data),
                })
            )
        ).then(responses => ({ data: responses.map(({ json }) => json.id) })
    ),

    getManyReference: (resource, params) => {
        const { page, perPage } = params.pagination;
        const { field, order } = params.sort;
        const query = {
            sort: JSON.stringify([field, order]),
            range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
            filter: JSON.stringify({
                ...params.filter,
                [params.target]: params.id,
            }),
        };
        const url = `${apiUrl}/${resource}?${stringify(query)}`;

        return httpClient(url).then(({ headers, json }) => ({
            data: json,
            total: parseInt(headers.get('content-range').split('/').pop(), 10),
        }));
    },

    create: (resource, params) =>
        httpClient(`${apiUrl}/${resource}`, {
            method: 'POST',
            body: JSON.stringify(params.data),
        }).then(({ json }) => ({
            data: { ...params.data, id: json.id },
        })
    ),

    update: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`, {
            method: 'PUT',
            body: JSON.stringify(params.data),
        }).then(({ json }) => ({ data: json })
    ),

    // no updateMany route, so fallback to calling update n times instead
    updateMany: (resource, params) =>
        Promise.all(
            params.ids.map(id =>
                httpClient(`${apiUrl}/${resource}/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(params.data),
                })
            )
        ).then(responses => ({ data: responses.map(({ json }) => json.id) })
    ),
    
    delete: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`, {
            method: 'DELETE',
        }).then(({ json }) => ({ data: json })
    ),

    // we don't handle filters on DELETE route, so fallback to calling DELETE n times instead
    deleteMany: (resource, params) =>
        Promise.all(
            params.ids.map(id =>
                httpClient(`${apiUrl}/${resource}/${id}`, {
                    method: 'DELETE',
                })
            )
        ).then(responses => ({ data: responses.map(({ json }) => json.id) })
    ),
};
