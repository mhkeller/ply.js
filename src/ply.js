/* 
ply.js is a small library that crunches down data, loosely based on Hadley Wickham's dplyr for R. Here's a rundown of the API:

- `.group(...facets)` --- groups the data set based on `facets`, each full combination of which acts as a grouping facet.
- `.reduce(reducerFunctions)` --- takes an object with keys representing the variable to be created by the reducer, and the value is a function that takes all the grouped data and outputs a single value. The output is a reduced data set with all the `facets` defined by the `group` function and all the reduced values.
- `.filter(fcn)` --- filters the data set by a particular function. Works just like an Array filter.
- `.map(fcn)` --- maps the data set onto

And a single example of usage:

let a = new Dataframe(x)
a.group('c', 'd')
  .reduce({
	x: arr => arr.length,
    y: arr => arr.map(d=>d.b).reduce((a,b)=>a+b,0)
}}
  .transform()

*/

const STEPS = {
    GROUP: 'group',
    DATASET: 'dataset'
}

class Ply {

  constructor(data) {
    if (!Array.isArray(data)) throw new Error('data must be an array')
    // I guess this isn't a lot of objects to try. Let's go for it.
    data.forEach(d=>{
      if (!(typeof d == 'object' && d.constructor == Object)) throw Error('data must be an array of objects')
    })
    this.data = data
    this.step = STEPS.DATASET
    this.funcs = []
    this.facets = []
  }

  reset() {
    this.funcs = []
    this.step = STEPS.DATASET
    return this
  }
  
  group(...f) {
    this.funcs.push((data)=>{
      return data.reduce((o,v)=> {
        const facet = f.map(fi=>v[fi]).join(Ply.SEPARATOR)
        if (!o.hasOwnProperty(facet)) o[facet] = []
        o[facet].push(v)
        return o
      }, {})
    })
    this.facets = f
    this.step = STEPS.GROUP
    return this
  }
  
  map(mapper) {
    const mapData = (arr) => {
      return arr.map(mapper)
    }
    let step = this.step

    this.funcs.push((data)=>{
      if (step === STEPS.GROUP) {
        Object.keys(data).forEach(facets=>{
          data[facets] = data[facets].map(mapper)
        })

        return data
      }
      else return data.map(mapper)
    })
    this.step = STEPS.DATASET
    return this
  }

  filter(fcn) {
    if (this.step != STEPS.DATASET) {
      throw TypeError('cannot filter on a grouped data set')
    }
    this.funcs.push((data)=>{
      return data.filter(fcn)
    })
    return this
  }

  reduce(funcs) {
    // reduce the array to a single point
    const reduceData = (arr) => {
      let datapoint = {}
      Object.keys(funcs).forEach(field=>{
        if (typeof funcs[field] === 'function') datapoint[field] = funcs[field](arr)
        else datapoint[field] = funcs[field]
      })
      return datapoint
    }
    // a plainReducer reduces an array down to a single point w/ reduceData.
    const plainReducer = (data) => {
      return [reduceData(data)]
    }
    // a groupReducer iterates through the groups and runs plainReducer.
    const groupReducer = (data) => {
      let newData = []
      Object.keys(data).forEach(gr=>{
        let dataGrouping = data[gr]
        let datapoint = reduceData(dataGrouping)
        this.facets.forEach((f)=>{
          datapoint[f] = dataGrouping[0][f]
        })
        newData.push(Object.assign({}, datapoint))
      })
      data = newData
      return data
    }
  
    let reducer = this.step === STEPS.DATASET ? plainReducer : groupReducer

    this.funcs.push(reducer)
    this.step = STEPS.DATASET
	  return this
  }
 
  transform() {
    let newData = this.data.map(d=>Object.assign({}, d))
    this.funcs.forEach(d=>{newData = d(newData) })
    this.step = STEPS.DATASET
    return newData
  }
}

Ply.SEPARATOR = '||'
Ply.sum = (field) => (arr) => arr.map(d=>{
  if (!Number.isFinite(d[field])) throw new Error('cannot reduce non-Numbers')
  return d[field]
}).reduce((a,b)=>a+b,0)
Ply.mean = (field) => (arr) => Ply.sum(field)(arr) / arr.length
Ply.standardDeviation = (field) => null
Ply.variance = (field) => null
Ply.max = field => arr => Math.max(...arr.map(d=>d[field]))
Ply.min = field => arr => Math.min(...arr.map(d=>d[field]))
Ply.quantile = (q, field) => arr => {
  arr.sort((a,b)=>a[field]-b[field])
  return arr[Math.floor((arr.length-1)*q)][field]
}
Ply.median = field => arr => Ply.quantile(.5, field)(arr)

export default Ply