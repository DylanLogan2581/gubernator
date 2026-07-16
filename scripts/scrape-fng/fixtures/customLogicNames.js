var nm1 = ["Ash", "Bren", "Corr"];
var nm2 = ["a", "en", "ir"];

function nameGen(type) {
  var tp = type;
  var element = document.createElement("div");
  element.setAttribute("id", "result");

  for (i = 0; i < 10; i++) {
    if (tp === 1) {
      rnd = Math.floor(Math.random() * nm1.length);
      rnd2 = Math.floor(Math.random() * nm2.length);
      names = (nm1[rnd] + nm2[rnd2]).toUpperCase();
    } else {
      rnd = Math.floor(Math.random() * nm1.length);
      names = nm1[rnd];
    }
  }
  if (document.getElementById("result")) {
    document
      .getElementById("placeholder")
      .removeChild(document.getElementById("result"));
  }
  document.getElementById("placeholder").appendChild(element);
}
