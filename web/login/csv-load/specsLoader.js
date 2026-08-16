let phoneSpecs = [];

async function loadCsv() {
  const response = await fetch("csv-load/phones.csv");

  const csvText = await response.text();

  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  phoneSpecs = result.data;
  const models = phoneSpecs.map((product) => {
     return {
      model:product.model,
      category:product.category
     }
});
  console.log(Object.keys(phoneSpecs[0]));
  console.log(phoneSpecs[0]);
}

loadCsv();
