/*!
 * Copyright(c) 2014 Jan Blaha (pofider)
 *
 * Orchestrate the OData query GET requests
 */

/* eslint no-useless-escape: 0 */
/* eslint no-redeclare:0 */

const parser = require('odata-parser')
const queryTransform = require('./queryTransform.js')
const url = require('url')
const querystring = require('querystring')

module.exports = function (cfg, req, res) {
  const entitySet = cfg.model.schemas.map(schema => schema.entitySets || {}).find(entitySets => entitySets[req.params.collection])

  if (!entitySet) {
    const error = new Error()
    error.code = 404
    console.log('Entity set not found')
    console.log(error.stack)
    return res.odataError({ code: 404, message: 'Invalid resource' })
  }

  let queryOptions = {
    $filter: {}
  }

  function ensureQuotesForDates (queryString) {
    return queryString.replace(/(\b\w+\b)\s+(lt|gt|le|ge|eq|ne)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/g, "$1 $2 '$3'")
  }

  const _url = url.parse(req.url, true) // eslint-disable-line
  if (_url.search) {
    const query = _url.query
    const fixedQS = {}
    if (query.$) fixedQS.$ = query.$
    if (query.$expand) fixedQS.$expand = query.$expand
    if (query.$filter) fixedQS.$filter = query.$filter
    if (query.$format) fixedQS.$format = query.$format
    if (query.$inlinecount) fixedQS.$inlinecount = query.$inlinecount
    if (query.$select) fixedQS.$select = query.$select
    if (query.$skip) fixedQS.$skip = query.$skip
    if (query.$top) fixedQS.$top = query.$top
    if (query.$orderby) fixedQS.$orderby = query.$orderby

    const encodedQS = decodeURIComponent(querystring.stringify(fixedQS))
    if (encodedQS) {
      const fixedEncodedQS = ensureQuotesForDates(encodedQS) // FIX: Add quotes to dates
      queryOptions = queryTransform(parser.parse(fixedEncodedQS))
    }
    if (query.$count) {
      queryOptions.$inlinecount = true
    }
  }

  queryOptions.collection = req.params.collection

  if (req.params.$count) {
    queryOptions.$count = true
  }

  if (req.params.id) {
    req.params.id = req.params.id.replace(/\"/g, '').replace(/'/g, '')
    queryOptions.$filter = {
      _id: req.params.id
    }
  }

  cfg.executeQuery(queryOptions.collection, queryOptions, req, function (err, result) {
    if (err) {
      console.log('Error occurred:', err)
      if (!res.headersSent) {
        res.odataError(err)
      }
      return // Stop execution here
    }

    if (res.headersSent) {
      console.log('Skipping response since headers are already sent.')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal')
    res.setHeader('OData-Version', '4.0')
    cfg.addCorsToResponse(res)

    let out = {}
    // define the @odataContext in case of selection
    let sAdditionIntoContext = ''
    const oSelect = queryOptions.$select
    if (oSelect) {
      const countProp = Object.keys(oSelect).length
      let ctr = 1
      for (const key in oSelect) {
        sAdditionIntoContext += key.toString() + (ctr < countProp ? ',' : '')
        ctr++
      }
    }
    if (Object.prototype.hasOwnProperty.call(queryOptions.$filter, '_id')) {
      sAdditionIntoContext = sAdditionIntoContext.length > 0 ? '(' + sAdditionIntoContext + ')/$entity' : '/$entity'
      out['@odata.context'] = cfg.serviceUrl + '/$metadata#' + req.params.collection + sAdditionIntoContext
      if (result.length > 0) {
        for (const key in result[0]) {
          out[key] = result[0][key]
        }
      }
      // this shouldn't be done, but for backcompatibility we keep it for now
      out.value = result
    } else {
      sAdditionIntoContext = sAdditionIntoContext.length > 0 ? '(' + sAdditionIntoContext + ')' : ''
      out = {
        '@odata.context': cfg.serviceUrl + '/$metadata#' + req.params.collection + sAdditionIntoContext,
        value: result
      }
    }

    if (queryOptions.$inlinecount) {
      out['@odata.count'] = result.count
      out.value = result.value
    }
    cfg.pruneResults(queryOptions.collection, out.value)

    cfg.bufferToBase64(queryOptions.collection, out.value)

    return res.end(JSON.stringify(out))
  })
}
