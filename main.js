// DOM elements
const loginFormElement = document.getElementById('loginForm');
const usernameInputElement = document.getElementById('username');
const passwordInputElement = document.getElementById('password');
const mainElement = document.getElementById('main');

// Constants
const taskID = 85;

// Initialize variables
let totalXP = 0;
let auditXPDone = 0;
let auditXPRecived = 0;
let auditRatio = 0;
let projectsCompleted = 0;

// GraphQL query template
const userQuery = `
  query {
    user {
      firstName
      lastName
      auditRatio
      attrs
      transactions(where: {event: {id: {_eq: ${taskID}}}}) {
        type
        amount
        object {
          name
        }
      }
    }
  }
`;

// Event listener for form submission
loginFormElement.addEventListener('submit', handleLogin);

// Login function
async function loginUser(enteredUsername, enteredPassword) {
  const url = "https://01.kood.tech/api/auth/signin";
  const loginRequest = {
    method: 'POST',
    headers: {
      Authorization: `Basic ` + btoa(`${enteredUsername}:${enteredPassword}`)
    },
  };
  const response = await fetchAndParseResponse(url, loginRequest);

  if (response && response !== 0) {
    localStorage.setItem('accessToken', response);
    return response;
  }

  return null;
}

// GraphQL request function
async function fetchUserData(token) {
  const url = 'https://01.kood.tech/api/graphql-engine/v1/graphql';
  const graphqlRequest = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: userQuery }),
  };
  const response = await fetchAndParseResponse(url, graphqlRequest);
  return response;
}

// Generic fetch function
async function fetchAndParseResponse(url, request) {
  const response = await fetch(url, request);

  if (response.ok) {
    return await response.json();
  }
  return null;
}

// Convert bytes to kB
function bytesToKB(bytes) {
  return (bytes / 1000).toFixed(2);
}
// Convert bytes to MB
function bytesToMB(bytes) {
  return (bytes / 1000000).toFixed(2);
}

// Handle form submission
async function handleLogin(event) {
  event.preventDefault();
  const enteredUsername = usernameInputElement.value;
  const enteredPassword = passwordInputElement.value;

  try {
    const resp = await loginUser(enteredUsername, enteredPassword);

    if (resp) {
      loginFormElement.style.display = 'none';
      const token = resp;
      const graphqlResp = await fetchUserData(token);

      if (graphqlResp) {
        displayUserData(graphqlResp);
      } else {
        console.error("Failed GraphQL request!");
      }
    } else {
      document.getElementById("failed").innerHTML = `Username or password is incorrect!`;
    }
  } catch (error) {
    console.error(error);
  }
}

// Display user data
function displayUserData(resp) {
  const transactionsArray = Object.values(resp.data.user[0].transactions);
  transactionsArray.forEach((item) => {
    if (item.type === 'xp') {
      totalXP += item.amount;
      projectsCompleted++;
    }
  });

  totalXP = bytesToKB(totalXP);
  auditRatio = Math.round(resp.data.user[0].auditRatio * 100) / 100;

  const age = calculateAge(resp.data.user[0].attrs["dateOfBirth"]);
  const idCardInfo = `${age} years old!`;

  const userInfoHTML = `
    <div id="userInfo">
      <button type="submit" id="logout">Logout</button>
      <h1>Hello, ${resp.data.user[0].firstName} ${resp.data.user[0].lastName}!</h1>
      <div class="user-info">
        ${idCardInfo}
        <p>Projects completed: ${projectsCompleted}</p>
      </div>
    </div>`;

  mainElement.innerHTML = userInfoHTML + mainElement.innerHTML;

  const logoutButton = document.getElementById('logout');

  logoutButton.addEventListener('click', (e) => {
    localStorage.clear();
    window.location.reload();
  });

  createChart(transactionsArray, 'bar', true, `<h4> Total xp: ${totalXP} kB </h4>`, 'projects', 'chartContainer1');
  createChart(transactionsArray, 'doughnut', false, ``, 'auditRatio', 'chartContainer2');
}

// Calculate age
function calculateAge(targetDate) {
  const currentDate = new Date();
  const targetDateTime = new Date(targetDate);

  let age = currentDate.getFullYear() - targetDateTime.getFullYear();

  const birthMonth = targetDateTime.getMonth();
  const currentMonth = currentDate.getMonth();

  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDate.getDate() < targetDateTime.getDate())) {
    age--;
  }

  return age;
}

// Create a chart
function createChart(dataArray, graphType, checker, tableHeader, chartID, containerID) {
  const chartContainer = document.getElementById(containerID);
  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'chart-wrapper';
  chartWrapper.id = chartID;
  const head = document.createElement('h4');
  const chartCanvas = document.createElement('canvas');
  const values = setChartValues(dataArray, checker);

  if (!checker) {
    const auditXPDoneInMB = bytesToMB(auditXPDone);
    const auditXPRecivedInMB = bytesToMB(auditXPRecived);
    tableHeader = `<h4>Total Audit XP: ${auditXPDoneInMB} MB<br>Audit XP Recived: ${Math.round(auditXPRecivedInMB)} MB<br>Audit Ratio: ${auditRatio}</h4>`;
  }

  head.innerHTML = tableHeader;
  chartWrapper.appendChild(head);

  const ctx = chartCanvas.getContext('2d');
  new Chart(ctx, {
      type: graphType,
      data: values,
      options: {
          plugins: {
              legend: {
                  display: false,
              }
          }
      }
  });
  chartWrapper.appendChild(chartCanvas);
  chartContainer.appendChild(chartWrapper);
}

// Set chart values
function setChartValues(dataArray, checker) {
  const projectNames = [];
  const projectPoints = [];
  const randomColor = [];
  const borderColor = [];
  const backgroundColor = [];

  const sortedXpArray = [...dataArray];
  sortedXpArray.sort((a, b) => a.amount - b.amount);

  let done = 0;
  let received = 0;

  sortedXpArray.forEach((item) => {
    if (checker && item.type === "xp") {
      const xpInKB = bytesToKB(item.amount);
      projectPoints.push(xpInKB);
      projectNames.push(item.object.name);
    } else if (!checker && item.type === "up") {
      auditXPDone += item.amount;
      done++;
    } else if (!checker && item.type === "down") {
      auditXPRecived += item.amount;
      received++;
    }
  });

  if (!checker) {
    projectPoints.push(done, received);
    projectNames.push(`Audits done`, `Audits received`);
  }

  for (let i = 0; i < sortedXpArray.length; i++) {
    randomColor.push(generateRandomColor());
  }

  randomColor.forEach((colorObj) => {
    backgroundColor.push(colorObj.color);
    borderColor.push(colorObj.border);
  });

  return {
    labels: projectNames,
    datasets: [
      {
        data: projectPoints,
        backgroundColor: backgroundColor,
        borderColor: borderColor,
        borderWidth: 1,
      },
    ],
  };
}

// Generate random colors
function generateRandomColor() {
  const red = Math.floor(Math.random() * 200 + 56);
  const green = Math.floor(Math.random() * 200 + 56);
  const blue = Math.floor(Math.random() * 200 + 56);

  return {
    color: `rgba(${red}, ${green}, ${blue}, 0.5)`,
    border: `rgba(${red}, ${green}, ${blue}, 1)`
  };
}
